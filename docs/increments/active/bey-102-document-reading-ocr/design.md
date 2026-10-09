# AI models: document reading with OCR providers

Status: accepted on 9 October 2026 and built the same day ([plan](plan.md), [verification](verification.md)). Tracked in Linear as BEY-102. It changes the `ai` module and its screen only and adds no module and no dependency between modules, so there is no boundary discovery.

## What it does

A page of a PDF that is only a picture is read today by the chat model chosen for the task `DOCUMENT_READING`, one call a page (`DocumentPages.readPictures`). With this change operators can connect an OCR service and choose it as the reader instead. Document reading gets a tab of its own in Admin › AI › Providers; AI Hay's OCR is the first service.

GenAI Fund's tech teams were given early access to the AI Hay Open API Platform to try it (5–9 October). Its OCR API does this same job: one image in, the page's text out.

| Part          | What an operator sees                                                                                  | What the application gets                             |
| ------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| OCR providers | Admin › AI › Providers, a third tab, **OCR**. Preset: AI Hay                                           | A stored connection: adapter, endpoint, sealed key    |
| Reader        | One choice on that tab: a model that reads images, as today, or a connected OCR service. Saved at once | `DocumentPages` reads a page with whichever is chosen |
| Chat tab      | Models by task no longer lists document reading                                                        | Nothing                                               |
| Usage         | Nothing yet                                                                                            | One row per page read by OCR, without tokens          |

`search` and `matching`, which call `DocumentPages`, do not change.

## Order with BEY-101

[BEY-101](https://linear.app/beyondpilot/issue/BEY-101) gives every task a fallback model. This increment was first planned on top of it and is now done first (Đạt, 9 October), with **one** reader. BEY-101 then adds the second level here as it does for the other tasks: a fallback reader that is a model or an OCR service.

## Domain story

1. An operator opens Admin › AI › Providers › OCR, picks the AI Hay preset and gives a key.
2. They test the connection. BeyondPilot sends a small picture it carries, with a known line of text, and says whether the service read it and how long it took. This spends one call.
3. Under Reader they choose AI Hay instead of the model.
4. Search indexes a deck with slides that are only pictures. Each such page is sent to the service and its text is kept as the page's passage, as a model's would be.
5. The operator switches the reader back to a model. The next page is read by the model.

Failure and recovery:

- **No reader chosen, or the chosen one cannot be used** (its provider is switched off or has no readable key): pages are not read from their picture and stay to be read later, as today.
- **The service refuses the key, cannot be reached, or does not answer as its API should:** the test names which of the three, never the service's own text. While reading, the page is left unread, reading stops there, and the rest is asked for again later, as today.
- **A page's picture is still too large after it is compressed, or the service refuses it:** that page is kept as read with no text, so it is not sent again on every run, and the next ones are still read.
- **An OCR provider is deleted while it is the reader:** the reader becomes unset.
- **Two operators edit the same row:** the second save is refused as stale.

## Glossary

| Term         | Meaning                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| OCR provider | A stored connection with the purpose `ocr`: adapter, endpoint, key. A row of `ai_provider`, apart from chat and embedding |
| OCR adapter  | The code that speaks one OCR service's API: `aihay` first                                                                 |
| Reader       | What reads a page from its picture: a chat model that reads images, or an OCR provider                                    |
| Page picture | One PDF page rendered at 110 DPI, as `PdfPages` renders it today                                                          |

## Commands, facts and consistency

| Command (operator)                      | Rule checked in the same transaction                                                                                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connect, change, remove an OCR provider | The endpoint rule of chat providers; name unique per purpose; a known adapter; the row's version                                                                                    |
| Choose the reader                       | Exactly one of a model or an OCR provider, or none. A model reads images and its provider is enabled with a key, as today. An OCR provider is enabled with a key. The row's version |

| Fact                   | Who reacts                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| A page was read by OCR | A usage row is written after the call, in its own transaction; a row that cannot be written never fails the reading |

No event crosses a module boundary.

## Data and invariant owner

`ai` owns these tables and stays their only writer.

| Table           | Change                                                                                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai_provider`   | The purpose may be `ocr`; such a row has no vendor and names its adapter, as a chat row does                                                                                             |
| `ai_task_model` | Gains `ocr_provider_id` (to `ai_provider`, set to null when the provider is deleted). Checks: only `document_reading` may have one, and a row has a model or an OCR provider, never both |
| `ai_usage`      | No change. An OCR call is a row with the task `document_reading`, the provider, the adapter's type where a model's name would be, no tokens and no price                                 |

The reader chosen today, a model, stays chosen after the migration.

## How it is built

- **`OcrAdapter` behind `OcrAdapterRegistry`** in `ai.adapter`, the [interchangeable-implementations pattern](../../../conventions.md#interchangeable-implementations-strategy-behind-a-registry) as for chat: one page picture in, its text out; two beans with one type fail startup.
- **`AiHayOcrAdapter`** (`aihay`) posts the picture as base64 to `/v1/ocr` under the provider's endpoint, through `OutboundHttp`, the one client of the adapters for what they ask outside a vendor's SDK. It is a `RestClient` kept to MemoryOS's rules for outbound HTTP (its ADR 0025): no redirect followed, a deadline for the whole exchange, a bounded answer, and the status handed back with the bytes so that no provider's text reaches an exception. `ModelLists` moves onto it in this change. It reads the kind of a failure from the HTTP status, never from what the service wrote:

  | AI Hay answers                             | Kind                    |
  | ------------------------------------------ | ----------------------- |
  | 401, 403                                   | The key was refused     |
  | 400, 413                                   | The picture was refused |
  | 429, any 5xx, no answer, a timeout         | Unreachable             |
  | A redirect, or a body that is not its JSON | Incompatible            |

- **Pictures go to OCR as JPEG.** AI Hay refuses a body over 2 MB, and most rendered pages exceed that as PNG (see the findings). `PdfPages` renders the page as JPEG at quality 85 and lowers the quality while the picture is over the adapter's limit; a page still over it is answered as empty. A model keeps receiving PNG.
- **`DocumentPages`** asks which reader is chosen. For a model it does what it does today. For an OCR provider it sends each page through the adapter, one call a page. `readsPictures()` is true when the chosen reader can be used.
- **What OCR returns is kept as it comes**, which for AI Hay is Markdown. Nothing is removed or rewritten for now (Đạt, 9 October). The service can invent image syntax, seen once in the sample below; a filter is added when real readings show it is needed.
- **The reader is a command of its own**, no longer the task command of the Chat tab. `AiTask.DOCUMENT_READING` stays: it names the usage rows and the model's client.
- **Endpoints** under the admin AI controller: read the OCR settings (OCR providers, the adapters there are, the reader), connect, change, remove and test an OCR provider, choose the reader. The chat settings stop listing `document_reading`.

## Screen

The OCR tab has two blocks, top to bottom as the Chat tab: **Reader**, then **Available connections** with **Add provider**. Connections reuse the connection card and the provider dialog of the Chat tab, without the model list. The Reader block has a choice between a model and an OCR service: for a model, the Model selector limited to models that read images, as today; for a service, a list of the connected OCR providers.

Đạt agreed this layout from a description in words on 9 October, without a mock-up.

## Decisions

| Decision                                                                   | Why                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OCR providers are a purpose of `ai_provider`, not a table of their own     | The table already holds one row per connection and purpose, with the key sealing, the endpoint, on and off, and the audit record                                                                                                                                                                                                                                                 |
| The reader lives on the task's row                                         | It is the same fact as today, "what reads pages", with one more kind of answer                                                                                                                                                                                                                                                                                                   |
| A tab of its own for document reading                                      | An OCR service is not a chat provider. One place then holds the whole of reading: the connections and the choice                                                                                                                                                                                                                                                                 |
| A model stays the reader after the migration; OCR is chosen by an operator | On the sample below a small vision model read as well or better, its output is the plain text the pipeline keeps, and its cost is known. AI Hay is in early access                                                                                                                                                                                                               |
| No OpenRouter OCR provider                                                 | OpenRouter has no OCR endpoint, only a `file-parser` plugin inside chat completions, for PDFs. Its vision models already serve as a reader through the Chat tab                                                                                                                                                                                                                  |
| No generic "compatible" OCR adapter, and no Docling adapter yet            | There is no common OCR protocol: AI Hay takes `POST /v1/ocr` with a Bearer key, Docling Serve `POST /v1/convert/source` with `X-Api-Key`, each with its own answer. A self-hosted OCR model served over the OpenAI protocol already works as a chat provider. The adapter's shape, a picture in and text out, fits Docling; it is one class when a server exists to test against |
| No AI Hay chat adapter                                                     | See the findings                                                                                                                                                                                                                                                                                                                                                                 |
| Customers' decks and attachments go to AI Hay when it is the reader        | Accepted by Đạt on 9 October. It happens only by an operator's choice                                                                                                                                                                                                                                                                                                            |

## Findings from trying AI Hay (9 October)

Made with the early-access key, which is recorded nowhere in the repository or in Linear.

**OCR on real decks.** 39 decks were downloaded from staging's public API. 11 of them hold 48 picture-only pages, rendered at 110 DPI as the backend does. 16 pages, two a deck at most, were read three ways with the instruction `DocumentPages` sends:

|                    | gpt-6-luna (9Router, low) | gpt-5.6-luna (9Router, low) | AI Hay OCR      |
| ------------------ | ------------------------- | --------------------------- | --------------- |
| Succeeded          | 16/16                     | 16/16                       | 16/16           |
| Median time a page | 2.05 s                    | 2.75 s                      | 2.35 s          |
| Output             | Plain text                | Plain text                  | Markdown        |
| Tokens a page      | About 2,640 in, 89 out    | About 2,640 in, 241 out     | Billed per call |

- Five pages were checked against the picture by eye. gpt-6-luna dropped one partly hidden word and skipped a small sign inside a photo. gpt-5.6-luna replaced two words with likelier ones ("Ailytics" as "Analytics", "Near Machinery" as "Heavy Machinery"). AI Hay OCR got one Vietnamese tone mark wrong and invented a Markdown table with two image addresses that do not exist.
- 31 of the 48 pages exceed 1.4 MB as PNG (median 1.6 MB, largest 4.7 MB). As JPEG at quality 85 they are 223–444 KB and were read as well.
- On a picture with no text AI Hay OCR returned a description, where its documentation states an empty string.
- The sample is small: it supports a starting choice, not a ranking.

**The rest of the platform.**

- LLM Gateway (`/v1/gateway`): all 15 OpenAI models tried and three Gemini models answer 503 `upstream_unavailable`, before and after the organisation received credit; seven Gemini models answer. Through it Gemini ignores `tools` and `response_format` without an error and drops images. `usage` carries `input_tokens` and `output_tokens` in place of `prompt_tokens` and `completion_tokens`, which Spring AI 2.0.1 reads as required and would fail on. A streamed answer carries no usage chunk, unlike the documentation. Prices are in VND.
- Ask: about 12,000 input tokens a call with search off; the caller's system prompt has no effect; 5,000 characters a message. Not usable as a model for a task.
- Web Search, Translate, Suggestion, TTS and Summarize answer. Summarize took about 17 seconds and reported 3,803 output tokens for a summary of three sentences. Chat and Content by topic are not enabled for the organisation.

## Left out

- A fallback reader: BEY-101.
- The price of an OCR call. It is shown only in AI Hay's dashboard, behind sign-in, and is in VND; rows are recorded without a price until it is known.
- Reading a whole PDF in one call, and OCR of anything but page pictures.
- A screen for usage.

## References read

- AI Hay Open API Platform documentation, v1: Overview, OCR, LLM Gateway, Ask, Web Search, MCP and the others, read from the platform's own pages on 9 October.
- OpenRouter documentation, PDF inputs and the `file-parser` plugin.
- Docling Serve, `docs/usage.md`: `POST /v1/convert/source`, `X-Api-Key`, `document.md_content`.
- This repository: `DocumentPages`, `PdfPages`, `AiProviders`, `ModelLists`, the Chat tab's components.
