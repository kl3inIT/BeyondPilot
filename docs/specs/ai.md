# AI

The AI providers BeyondPilot calls, the chat models operators enabled, the model each task uses, and the record of what every call took. It was delivered by [BEY-92](../increments/active/bey-92-ai-models/design.md) and decided in [ADR 0006](../decisions/0006-an-ai-module-keeps-providers-and-models.md); it follows MemoryOS's model catalog, kept smaller. The code is the `ai` application module, `backend/src/main/java/ai/genaifund/beyondpilot/ai`. The checks that hold this contract are in the [AI matrix](../tests/ai.md).

## Module

- **Published API.** The package root:
  - `AiModels`: a task's chat client, borrowed, with every call recorded;
  - `AiProviders`: a provider of a purpose and its connection, for the module that uses that purpose;
  - `AiAdministration`: what operators do in the Chat tab;
  - `OcrAdministration`: what operators do in the OCR tab;
  - `DocumentPages`: the text of a PDF's pages, for the modules that keep what a file says;
  - `AiTask`, `AiSubject`, `AiChat`, `ReasoningEffort`, `AiException` and `AiErrorCode`.
- **Adapters.** `ai.adapter` holds `ChatAdapter`, one implementation per API, and `ChatAdapterRegistry`, an open family keyed by the adapter's type: two beans with one type stop the application from starting. `OcrAdapter` and `OcrAdapterRegistry` are the same for OCR services, with `aihay` as the first.
- **Outbound HTTP.** What an adapter asks outside its vendor's SDK, listing models and reading a picture, goes through `ai.adapter.OutboundHttp`, a `RestClient` kept to MemoryOS's rules (its ADR 0025): no redirect is followed, an exchange ends at its deadline, an answer is read up to a bound, and the status comes back with the bytes whatever it is, so a provider's text reaches no exception and no log. Plain `http` stays on HTTP/1.1, which self-hosted gateways speak. Chat and embedding calls go through the vendors' SDKs.
- **Persistence.** `ai.persistence`: `AiProvider`, `AiModel`, `AiTaskModel` with their Spring Data repositories, and `AiUsageRepository`, which adds usage rows with `JdbcClient`.
- **Dependencies.** `audit` and `identity`. The module knows no caller: `search` depends on it for its embedding provider.

## Data

`V42` created `ai_provider` under `search`; `V57` extended it and added the rest.

| Table           | Holds                                                                                                                                                                                                                                                                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai_provider`   | One connection: `purpose` (`embedding`, `chat` or `ocr`), `adapter_type`, `base_url`, the sealed `api_key`, `enabled`, `version`, and for an OCR provider `price_per_1k_calls`. `vendor` is set for an embedding provider only. A name is unique within a purpose                                                                                                 |
| `ai_model`      | A model an operator enabled on a chat provider: `model_name`, `display_name`, `context_window`, `max_output_tokens`, `tool_calling`, `vision`, `reasoning`, and `input_price`, `output_price`, `cached_input_price` in US dollars per million tokens. Unique on provider and model name; removed with its provider                                                |
| `ai_task_model` | One row per `AiTask`: `model_id` and `reasoning_effort`. Seeded unset; `model_id` becomes null when the model is removed. The row of `document_reading` may name `ocr_provider_id` in place of a model, never both; it becomes null when that provider is removed                                                                                                 |
| `ai_usage`      | One row per call: when, `task` (or `model_test`), the provider and model by name, tokens in, out, cache read and cache write, `duration_ms`, `outcome`, `error_type`, what it was about (`subject_type`, `subject_id`), and the three prices as they were then. Rows are only added, and none references a provider or model, so removing either keeps the record |

## Providers and keys

- **A provider belongs to one purpose.** A chat provider and an embedding provider are separate rows, even with the same key. The module that uses a purpose decides what an address and a model may be.
- **Keys are sealed** with AES-256-GCM and a random IV per value under `BEYONDPILOT_AI_ENCRYPTION_KEY` (`beyondpilot.ai.encryption-key`, 32 bytes in Base64). Without it no key is stored or read. A read never returns a key, only `hasKey`.
- **Keep, replace, remove.** A save names what becomes of the saved key. A new provider takes `replace`.
- **A saved key is kept only while the address is unchanged**, and a test without a typed key uses the saved one only for the address it was saved with. Otherwise an operator could point a provider at a server of their own and receive the key.
- **A provider in use cannot be removed.** What uses a provider points at it in the database, and the refusal becomes `AI_PROVIDER_IN_USE`.
- **Each change is audited**: `ai.provider_create`, `ai.provider_update`, `ai.provider_delete`, with the kind of provider and what became of the key, never the key.

## Chat providers

- **Adapters.** `openai` serves every provider that speaks the OpenAI API (OpenAI, 9Router, OpenRouter, any compatible endpoint); they differ only by address. `anthropic` serves Claude through Spring AI's Anthropic module.
- **The address** is `http` or `https`, private hosts included, at most 2,048 characters, with no credentials, query or fragment (`ChatEndpoints`). An address written as a link-local IP (`169.254.0.0/16`, `fe80::/10`, the AWS metadata address) is refused; a host name is not looked up, since operators are trusted to name an endpoint. An address typed with or without a trailing slash, or with `/v1` for Anthropic, reaches the same API.
- **Listing models** is one `GET` (`{base}/models` with a bearer key; `{base}/v1/models` with `x-api-key` for Anthropic) through `OutboundHttp` that reads at most 16 MiB and 1,000 models, and waits at most `beyondpilot.ai.list-timeout` (20 s).
- **A failure has one of three names**, and nothing the provider said reaches a response or a log:
  - `rejected`: status 401 or 403;
  - `unreachable`: no connection, a timeout, or a status of 500 and above;
  - `incompatible`: any other status of 300 and above, an empty or oversize answer, or JSON without a `data` array.
- **A provider test** lists the models and answers `ok`, how many and how long. No tokens are spent.
- **Switched off**, a provider keeps its key and its models; no task can use it.

## Models

- **Read from the provider, completed by the catalog.** What a provider lists about a model wins; what it leaves out comes from `ai/known-models.json`, found by name with or without a vendor prefix. The catalog is built from LiteLLM's public price list by `backend/scripts/sync-known-models.mjs`, which is MemoryOS's transformation: chat models of OpenAI, Anthropic, Gemini, xAI, DeepSeek and Mistral that publish both limits and both prices and whose deprecation date has not passed. Each price is the base rate: the higher rate some vendors charge above a token threshold is not carried, by the catalog or by `ai_model` and `ai_usage`. The LiteLLM commit, the day it was read and the licence are in the file. Otherwise:
  - an unknown context window is 32,000 and marked `source: none`;
  - an unknown answer limit and an unknown price stay null;
  - a model is taken to call tools; vision and reasoning are declared only when published.
- **When both know a model, the smaller context window holds**, since a router can list more than a route accepts.
- **An operator enables models** by adding them to a provider, and may correct every value. An answer limit must be smaller than the context window.
- **A model test** asks an enabled model "Reply OK." without a reasoning level and answers whether it replied and how long it took, never what the provider said. It spends a few tokens and is recorded with `model_test` where a task's name would be.

## Models by task

- **A task is named in code** (`AiTask`): `matching` and `document_reading`. Each has a model and a reasoning level (`off`, `low`, `medium`, `high`); the task's own default applies until an operator sets one.
- **A model can be chosen** only while its provider is switched on and has a key.
- **A task is available** when a model is chosen, its provider is switched on and its key can be read. Otherwise `AiModels.chat` refuses with `AI_TASK_NOT_CONFIGURED`. No model is used that nobody chose.
- **The level is sent only to a model that reasons**, the way its API asks for it: `reasoning_effort` for the OpenAI API, with off as `none`; a thinking budget of 2,048, 8,192 or 24,576 tokens for Claude, and thinking disabled for off.

## Reading documents

- **A second task, `document_reading`,** copies the text of a page that is only a picture. Its reader is chosen in the OCR tab, not with the other tasks: a model that reads images (another is refused with `AI_MODEL_WITHOUT_VISION`; its default reasoning level is `low`), or a connected OCR provider that is switched on and has a key (another is refused with `AI_OCR_PROVIDER_UNAVAILABLE`). Naming both is refused with `AI_READER_AMBIGUOUS`.
- **`DocumentPages`** reads a PDF for the modules that keep what a file says. `text` gives the text each page holds, with PDFBox and no model; a page without text is an empty string. `readPictures` draws the pages asked for as pictures (110 DPI, as JPEG) and has the reader copy the text of each, one call a page, each recorded in `ai_usage`. A picture is kept under 1.5 MB for a model, and under the service's own limit for an OCR service, by lowering its quality; a page that cannot fit is settled as empty. A gateway refuses a larger request: on 9 October the 9Router route answered 413 to pages of large slides sent as PNG. It stops at the first call that fails and answers what it read until then.
- **An OCR provider as the reader.** A page goes to it as a JPEG at quality 85, lowered while the picture is over the adapter's limit (1.4 MB for AI Hay, whose API refuses a body over 2 MB). What the service returns is kept as it comes; for AI Hay that is Markdown. A page still over the limit, or one the service refuses (400, 413), is answered as empty, so it is not sent again on every run; a refused key, a limit on calls or no answer stops the reading. A usage row of an OCR call has the adapter's type where a model's name would be and no tokens.
- **What an OCR call costs.** A service bills by the call, so an OCR provider keeps `price_per_1k_calls`, US dollars per 1,000 calls, entered by an operator; each usage row copies it as it was then, in its own column. Nothing here converts currencies: a price listed in another currency is entered in dollars. The AI Hay preset fills in 1.50, its listed 40,500 VND per 1,000 calls at the 27,000 VND to the dollar its own price list uses (read on 9 October 2026).
- **An OCR connection test** sends the small picture the application carries (`ai/ocr-test.jpg`) and looks for its line of text in the answer. It spends one call at the service and is not recorded.

## Calling a model

- **`AiModels.chat(task, subject)`** answers an `AiChat` holding a Spring AI `ChatClient`. The caller closes it when its work is done.
- **Clients are leased** (`ModelClients`, after MemoryOS): one per model and level, at most `beyondpilot.ai.max-clients` (32). When the provider or the model is saved, the next call gets a new client and the old one is closed once its last call has returned. A full cache gives up an idle client, and refuses with `AI_BUSY` when every one is in use.
- **A call** waits at most `beyondpilot.ai.call-timeout` (120 s) and is retried once by the client.
- **Every call is recorded** by one advisor around the whole call, from Spring AI's `Usage`: tokens in and out, tokens read from and written to the provider's cache, the duration, the outcome and the model's prices at that moment. A call that fails is recorded with the class of the failure. No prompt and no answer is kept, and a record that cannot be written never fails the call.

## HTTP

Every endpoint is for operators and is under `/api/ai/admin/chat`. Each change answers the whole of the settings.

| Endpoint                                                           | Does                                                                 |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `GET`                                                              | The providers with their models, the adapters, and each task's model |
| `POST /providers`, `PUT /providers/{id}`, `DELETE /providers/{id}` | Connect, change, remove a provider                                   |
| `POST /providers/test`                                             | Try a connection, saved or not                                       |
| `POST /providers/reported-models`                                  | The models a provider lists, saved or not                            |
| `POST /providers/{id}/models`                                      | Enable models                                                        |
| `PUT /models/{id}`, `DELETE /models/{id}`                          | Correct or remove a model                                            |
| `POST /models/{id}/test`                                           | Ask a model one line to prove it answers                             |
| `PUT /tasks/{task}`                                                | Choose a task's model and level                                      |

The embedding providers keep their endpoints under `/api/search/admin` ([search](search.md)).

## Screen

Admin › AI › Providers (`/admin/ai/providers`) has a tab per purpose, each an address of its own: Chat first, Embedding at `?tab=embedding` ([search](search.md)) and OCR at `?tab=ocr`. The Chat tab is `web/src/features/ai`:

- **Models by task.** One row per task with assistant-ui's Model selector: search, a group per provider, and the reasoning row for a model that reasons. A choice is saved at once. Only a model of a switched-on provider with a key is offered.
- **Available connections.** One card per provider: test, edit, delete, and its models in a table, fetched from the provider or added by name, corrected, tested and removed. Below 768px the three actions fold into one menu and the table keeps the name and the context window.
- **Add provider.** Presets are web data only: OpenAI and Claude, the gateways 9Router and OpenRouter, and OpenAI-Compatible. Each opens the same dialog with its adapter and, where there is one, its address.
- **Marks.** A provider shows its own mark; a model shows the mark of the vendor that makes it, read from its name, so a model served through a gateway still shows who made it. The marks are the ones MemoryOS uses: assistant-ui's logos element and LobeHub's icons (MIT).

The OCR tab, in the same folder:

- **Reader.** One row for reading documents, with a choice between a model and an OCR service. A model is picked with the same Model selector, limited to models that read images, which come from the Chat tab; a service is picked among the OCR providers that are switched on and have a key. Switching between the two saves nothing; picking one saves at once.
- **Available connections.** One card per OCR provider: test, edit, delete, and whether it reads documents.
- **Add provider.** One preset, AI Hay, with its address.

## Errors

`AiErrorCode`, turned into a problem by `config.ApiExceptionHandler` ([API errors](../conventions.md#api-errors)).

| Status | Codes                                                                                                                                                                                                                                                                                |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 400    | `AI_MODEL_WITHOUT_VISION`, `AI_READER_AMBIGUOUS`, `AI_OCR_PROVIDER_UNAVAILABLE`, `AI_PROVIDER_ENDPOINT_INVALID`, `AI_PROVIDER_ADAPTER_UNKNOWN`, `AI_PROVIDER_KEY_MISSING`, `AI_PROVIDER_CREDENTIAL_REJECTED`, `AI_PROVIDER_INCOMPATIBLE`, `AI_MODEL_INVALID`, `AI_MODEL_UNAVAILABLE` |
| 404    | `AI_PROVIDER_NOT_FOUND`, `AI_MODEL_NOT_FOUND`, `AI_TASK_UNKNOWN`                                                                                                                                                                                                                     |
| 409    | `AI_PROVIDER_NAME_TAKEN`, `AI_PROVIDER_CHANGED`, `AI_PROVIDER_IN_USE`, `AI_MODEL_NAME_TAKEN`, `AI_MODEL_CHANGED`, `AI_TASK_CHANGED`                                                                                                                                                  |
| 503    | `AI_ENCRYPTION_KEY_MISSING`, `AI_PROVIDER_UNREACHABLE`, `AI_TASK_NOT_CONFIGURED`, `AI_BUSY`                                                                                                                                                                                          |

## Audit

Beside the provider actions: `ai.model_add`, `ai.model_update` and `ai.model_remove`, each naming the provider, and `ai.task_model_change`, naming the model and the level, or the OCR provider where one was chosen to read documents.

## Not done

- No screen shows usage or cost yet; `ai_usage` is read by a later cost module.
- No budget or limit on calls.
- No streaming advisor yet: the recorder covers `call()`, which is what matching uses.
