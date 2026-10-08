# AI

The AI providers BeyondPilot calls, the chat models operators enabled, the model each task uses, and the record of what every call took. It was delivered by [BEY-92](../increments/active/bey-92-ai-models/design.md) and decided in [ADR 0006](../decisions/0006-an-ai-module-keeps-providers-and-models.md); it follows MemoryOS's model catalog, kept smaller. The code is the `ai` application module, `backend/src/main/java/ai/genaifund/beyondpilot/ai`. The checks that hold this contract are in the [AI matrix](../tests/ai.md).

## Module

- **Published API.** The package root:
  - `AiModels`: a task's chat client, borrowed, with every call recorded;
  - `AiProviders`: a provider of a purpose and its connection, for the module that uses that purpose;
  - `AiAdministration`: what operators do in the Chat tab;
  - `AiTask`, `AiSubject`, `AiChat`, `ReasoningEffort`, `AiException` and `AiErrorCode`.
- **Adapters.** `ai.adapter` holds `ChatAdapter`, one implementation per API, and `ChatAdapterRegistry`, an open family keyed by the adapter's type: two beans with one type stop the application from starting.
- **Persistence.** `ai.persistence`: `AiProvider`, `AiModel`, `AiTaskModel` with their Spring Data repositories, and `AiUsageRepository`, which adds usage rows with `JdbcClient`.
- **Dependencies.** `audit` and `identity`. The module knows no caller: `search` depends on it for its embedding provider.

## Data

`V42` created `ai_provider` under `search`; `V56` extended it and added the rest.

| Table | Holds |
| --- | --- |
| `ai_provider` | One connection: `purpose` (`embedding` or `chat`), `adapter_type`, `base_url`, the sealed `api_key`, `enabled`, `version`. `vendor` is set for an embedding provider only. A name is unique within a purpose |
| `ai_model` | A model an operator enabled on a chat provider: `model_name`, `display_name`, `context_window`, `max_output_tokens`, `tool_calling`, `vision`, `reasoning`, and `input_price`, `output_price`, `cached_input_price` in US dollars per million tokens. Unique on provider and model name; removed with its provider |
| `ai_task_model` | One row per `AiTask`: `model_id` and `reasoning_effort`. Seeded unset; `model_id` becomes null when the model is removed |
| `ai_usage` | One row per call: when, `task` (or `model_test`), the provider and model by name, tokens in, out, cache read and cache write, `duration_ms`, `outcome`, `error_type`, what it was about (`subject_type`, `subject_id`), and the three prices as they were then. Rows are only added, and none references a provider or model, so removing either keeps the record |

## Providers and keys

- **A provider belongs to one purpose.** A chat provider and an embedding provider are separate rows, even with the same key. The module that uses a purpose decides what an address and a model may be.
- **Keys are sealed** with AES-256-GCM and a random IV per value under `BEYONDPILOT_AI_ENCRYPTION_KEY` (`beyondpilot.ai.encryption-key`, 32 bytes in Base64). Without it no key is stored or read. A read never returns a key, only `hasKey`.
- **Keep, replace, remove.** A save names what becomes of the saved key. A new provider takes `replace`.
- **A saved key is kept only while the address is unchanged**, and a test without a typed key uses the saved one only for the address it was saved with. Otherwise an operator could point a provider at a server of their own and receive the key.
- **A provider in use cannot be removed.** What uses a provider points at it in the database, and the refusal becomes `AI_PROVIDER_IN_USE`.
- **Each change is audited**: `ai.provider_create`, `ai.provider_update`, `ai.provider_delete`, with the kind of provider and what became of the key, never the key.

## Chat providers

- **Adapters.** `openai` serves every provider that speaks the OpenAI API (OpenAI, 9Router, OpenRouter, any compatible endpoint); they differ only by address. `anthropic` serves Claude through Spring AI's Anthropic module.
- **The address** is `http` or `https`, private hosts included, at most 2,048 characters, with no credentials, query or fragment (`ChatEndpoints`). An address typed with or without a trailing slash, or with `/v1` for Anthropic, reaches the same API.
- **Listing models** is one `GET` (`{base}/models` with a bearer key; `{base}/v1/models` with `x-api-key` for Anthropic) that never follows a redirect, reads at most 16 MiB and 1,000 models, and waits at most `beyondpilot.ai.list-timeout` (20 s).
- **A failure has one of three names**, and nothing the provider said reaches a response or a log:
  - `rejected`: status 401 or 403;
  - `unreachable`: no connection, a timeout, or a status of 500 and above;
  - `incompatible`: any other status of 300 and above, an empty or oversize answer, or JSON without a `data` array.
- **A provider test** lists the models and answers `ok`, how many and how long. No tokens are spent.
- **Switched off**, a provider keeps its key and its models; no task can use it.

## Models

- **Read from the provider, completed by the catalog.** What a provider lists about a model wins; what it leaves out comes from `ai/known-models.json` (MemoryOS's, taken from LiteLLM's public price list, licence in the file), found by name with or without a vendor prefix. Otherwise:
  - an unknown context window is 32,000 and marked `source: none`;
  - an unknown answer limit and an unknown price stay null;
  - a model is taken to call tools; vision and reasoning are declared only when published.
- **When both know a model, the smaller context window holds**, since a router can list more than a route accepts.
- **An operator enables models** by adding them to a provider, and may correct every value. An answer limit must be smaller than the context window.
- **A model test** asks an enabled model "Reply OK." without a reasoning level and answers whether it replied and how long it took, never what the provider said. It spends a few tokens and is recorded with `model_test` where a task's name would be.

## Models by task

- **A task is named in code** (`AiTask`): `matching` first. Each has a model and a reasoning level (`off`, `low`, `medium`, `high`); the task's own default applies until an operator sets one.
- **A model can be chosen** only while its provider is switched on and has a key.
- **A task is available** when a model is chosen, its provider is switched on and its key can be read. Otherwise `AiModels.chat` refuses with `AI_TASK_NOT_CONFIGURED`. No model is used that nobody chose.
- **The level is sent only to a model that reasons**, the way its API asks for it: `reasoning_effort` for the OpenAI API, with off as `none`; a thinking budget of 2,048, 8,192 or 24,576 tokens for Claude, and thinking disabled for off.

## Calling a model

- **`AiModels.chat(task, subject)`** answers an `AiChat` holding a Spring AI `ChatClient`. The caller closes it when its work is done.
- **Clients are leased** (`ModelClients`, after MemoryOS): one per model and level, at most `beyondpilot.ai.max-clients` (32). When the provider or the model is saved, the next call gets a new client and the old one is closed once its last call has returned. A full cache gives up an idle client, and refuses with `AI_BUSY` when every one is in use.
- **A call** waits at most `beyondpilot.ai.call-timeout` (120 s) and is retried once by the client.
- **Every call is recorded** by one advisor around the whole call, from Spring AI's `Usage`: tokens in and out, tokens read from and written to the provider's cache, the duration, the outcome and the model's prices at that moment. A call that fails is recorded with the class of the failure. No prompt and no answer is kept, and a record that cannot be written never fails the call.

## HTTP

Every endpoint is for operators and is under `/api/ai/admin/chat`. Each change answers the whole of the settings.

| Endpoint | Does |
| --- | --- |
| `GET` | The providers with their models, the adapters, and each task's model |
| `POST /providers`, `PUT /providers/{id}`, `DELETE /providers/{id}` | Connect, change, remove a provider |
| `POST /providers/test` | Try a connection, saved or not |
| `POST /providers/reported-models` | The models a provider lists, saved or not |
| `POST /providers/{id}/models` | Enable models |
| `PUT /models/{id}`, `DELETE /models/{id}` | Correct or remove a model |
| `POST /models/{id}/test` | Ask a model one line to prove it answers |
| `PUT /tasks/{task}` | Choose a task's model and level |

The embedding providers keep their endpoints under `/api/search/admin` ([search](search.md)).

## Errors

`AiErrorCode`, turned into a problem by `config.ApiExceptionHandler` ([API errors](../conventions.md#api-errors)).

| Status | Codes |
| --- | --- |
| 400 | `AI_PROVIDER_ENDPOINT_INVALID`, `AI_PROVIDER_ADAPTER_UNKNOWN`, `AI_PROVIDER_KEY_MISSING`, `AI_PROVIDER_CREDENTIAL_REJECTED`, `AI_PROVIDER_INCOMPATIBLE`, `AI_MODEL_INVALID`, `AI_MODEL_UNAVAILABLE` |
| 404 | `AI_PROVIDER_NOT_FOUND`, `AI_MODEL_NOT_FOUND`, `AI_TASK_UNKNOWN` |
| 409 | `AI_PROVIDER_NAME_TAKEN`, `AI_PROVIDER_CHANGED`, `AI_PROVIDER_IN_USE`, `AI_MODEL_NAME_TAKEN`, `AI_MODEL_CHANGED`, `AI_TASK_CHANGED` |
| 503 | `AI_ENCRYPTION_KEY_MISSING`, `AI_PROVIDER_UNREACHABLE`, `AI_TASK_NOT_CONFIGURED`, `AI_BUSY` |

## Audit

Beside the provider actions: `ai.model_add`, `ai.model_update` and `ai.model_remove`, each naming the provider, and `ai.task_model_change`, naming the model and the level.

## Not done

- No screen shows usage or cost; `ai_usage` is read by a later cost module.
- No budget or limit on calls.
- No streaming advisor yet: the recorder covers `call()`, which is what matching uses.
