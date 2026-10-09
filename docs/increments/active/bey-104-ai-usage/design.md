# AI usage: every call in a log, with what succeeded, what failed and what it cost

Status: proposed on 9 October 2026 ([plan](plan.md)). Tracked in Linear as BEY-104. It adds a screen and read-only endpoints to the `ai` module; no new module and no new dependency between modules, so there is no boundary discovery.

## What it does

Every call to a chat model or an OCR service already leaves a row in `ai_usage` ([BEY-92](../bey-92-ai-models/design.md) started it, [BEY-102](../bey-102-document-reading-ocr/design.md) added OCR calls, [BEY-103](../bey-103-prices-follow-the-catalog/design.md) the price in effect). Nothing shows those rows. On 9 October the reader of document pages failed about once a minute for over an hour, 93 calls, and it was found only by reading the staging database.

Operators get a page, **Admin › AI › Usage**, with two tabs.

| Tab      | What an operator sees                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| Overview | Totals for a period, two charts over time, and a table by task, model and provider                            |
| Calls    | The log: one row a call, newest first, with filters and pages. A failed call says what kind of failure it was |

It is modelled on two screens the team knows: 9router's Usage page (an overview and a request log) and MemoryOS's "AI costs" (totals, a daily chart, breakdowns), kept to what BeyondPilot has.

## Domain story

1. An operator opens Admin › AI › Usage. The Overview shows the last 7 days: say 1,240 calls, 1,147 succeeded and 93 failed, the tokens, an estimated cost, and 310 calls without a known price. (The figures in this story are an example.)
2. The chart of calls a day shows a red band on one day. The table below says the failures are all on Reading documents, on one model.
3. They open the Calls tab, filter by "Failed" and by that task, and see the 93 rows: one a minute, each with its kind of failure and the deck it was reading.
4. They change the reader in the OCR tab, come back, and see the calls succeed.

Failure and recovery:

- **No call in the period:** the totals are zero, the charts and the table say there is nothing yet.
- **A call was made before its model had a price:** it counts as a call without a known price and adds nothing to the cost. The cost shown is then a lower bound, and the page says how many calls it leaves out.
- **A provider or a model was removed since:** its rows stay, under the name they were recorded with.

## Glossary

| Term            | Meaning                                                                                                                                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Call            | One row of `ai_usage`: one request to a chat model or an OCR service                                                                                                                                                               |
| Outcome         | `ok` or `failed`, as the row keeps it                                                                                                                                                                                              |
| Kind of failure | What a failed call was, for a person: the key was refused, the provider limited calls, did not answer, refused the request, or something else. Derived from the HTTP status where the row has one, else from the exception's class |
| Estimated cost  | What a call would cost at the price recorded with it. Not an invoice                                                                                                                                                               |
| Unknown cost    | A call recorded without a price. Counted apart, never as zero                                                                                                                                                                      |
| Subject         | What a call was about, as the caller named it: a solution's deck, a matching run                                                                                                                                                   |

## What a call costs

Computed when read, from what the row keeps; nothing is stored.

| Call                     | Cost                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A chat model, priced     | `(input − cache read) × input price + cache read × cached price + output × output price`, per million tokens. Without a cached price, cached input costs the input price. This is MemoryOS's formula, for usage where the input count includes the cached tokens, as OpenAI reports it. Whether Spring AI's `Usage` gives Anthropic's the same way is checked in step 3 before the formula is written |
| An OCR service, priced   | `price per 1,000 calls ÷ 1,000`, for a call that answered                                                                                                                                                                                                                                                                                                                                             |
| Any call without a price | Unknown                                                                                                                                                                                                                                                                                                                                                                                               |
| A failed call            | Nothing: a provider does not bill a call it refused. It still counts as a call                                                                                                                                                                                                                                                                                                                        |

Whether a failed call is billed differs by provider and by failure; counting it as nothing keeps the estimate from overstating. The page states that costs are estimates from the usage providers report and from list prices, and that a gateway on a subscription, such as 9Router, is not billed by the token at all.

## Data and invariant owner

`ai` owns `ai_usage` and stays its only writer.

| Table      | Change                                                                                                                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai_usage` | Gains `error_status`, the HTTP status of a failed call where the provider answered with one; null for a call that answered, for a failure without a status (a timeout), and for every row written before |

No rollup table. `ai_usage` is indexed by time and by task, and the volume is small: staging wrote 1,576 rows on 9 October, the day matching and document reading first ran in earnest. The endpoints bound what they read: a period of at most 92 days, and a page of at most 100 calls.

**To decide with Đạt:** whether to add `error_status`. Without it, 9 October's failures read `UnexpectedStatusCodeException` where the status was 413, and a refused request cannot be told from a provider that is down.

## How it is built

- **`AiUsageRepository`** gains the reads, in SQL: totals for a period, a series by day, a breakdown by task, model and provider, and a page of calls with filters. Costs are computed in SQL with the formula above.
- **`AiUsageReports`**, an application service of `ai`, checks the operator and answers the records. Read-only.
- **Endpoints** under `/api/ai/admin/usage`: `summary`, `daily`, `breakdown` and `calls`, each taking `from` and `to` (dates, in `Asia/Ho_Chi_Minh`, the zone the screens show), and `calls` taking the filters and a page.
- **`error_status`** is filled by `UsageRecorder` from the SDK's exception where it carries a status (`OpenAIServiceException`, `AnthropicServiceException`) and by `DocumentPages` for an OCR call, whose adapter then says the status it met.
- **Web:** `web/src/features/ai`, a route `/admin/ai/usage`, an entry in the admin sidebar under AI. The tabs are addresses of their own, as on the Providers page. Charts are Recharts through the installed shadcn `chart` primitive, which no screen uses yet; tables, filters and pages reuse what the audit log and the MCP activity page use.

## Screen

**Overview**, top to bottom:

1. A period switch: Today, 7 days, 30 days.
2. Four totals in a row: Calls (with succeeded and failed under it), Failure rate, Tokens (in and out), Estimated cost (with "n calls without a known price" under it when there are any).
3. Two charts side by side from 1024px, stacked below it: **Calls a day**, bars stacked as succeeded and failed; **Estimated cost a day**, bars stacked by task.
4. A table **By task, model and provider**: calls, failed, failure rate, tokens in and out, average duration, estimated cost. Sorted by calls.
5. One line of small print: what "estimated" means.

**Calls**:

1. Filters in one bar: task, provider, model, outcome (All, Succeeded, Failed), from and to.
2. A table, newest first: time, task, model with its provider under it, outcome as a badge, tokens in and out, cached, duration, cost, subject. A failed row shows the kind of failure in place of the tokens. From 768px a table; below it, stacked rows with time, task, model and outcome.
3. Pages of 50.

The charts carry their numbers as text as well: the table under them holds the same figures, and each chart has a short description for a screen reader.

**To decide with Đạt:** whether this layout is approved from a Figma frame or from this description, as the OCR tab was.

## Decisions

| Decision                                         | Why                                                                                                                                                                               |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A page of its own, not a line on each task's row | A line would say a task is failing; it would not show which calls, since when, or what they cost. Đạt asked for the log and the statistics, as 9router has them                   |
| No prompt and no answer in the log               | They are not stored, by BEY-92's decision: they can hold customers' data. 9router keeps them because it is one person's tool                                                      |
| A call without a price is unknown, never zero    | MemoryOS's rule. The first calls on staging were recorded before their models had a price; counted as zero they would make the total look complete                                |
| Costs are computed when read, not stored         | The row keeps the tokens and the prices of its time, which is all the formula needs. A stored cost would have to be recomputed if the formula were corrected                      |
| No rollup table                                  | MemoryOS rolls up by day because limits block on its totals and it serves many people. Here some thousand rows a day are counted directly                                         |
| Recharts through the shadcn chart primitive      | Both are installed. The primitive gives the charts the design tokens and the tooltip of the rest of the screens                                                                   |
| A fallback model per task (BEY-101) is put aside | The 93 failures were a request the gateway refused for its size, which another model would have refused too, and they were fixed at the request. What was missing was seeing them |

## Left out

- Usage by person or group, spending limits and exported reports, which MemoryOS has: no end user calls a model here yet.
- A notification when a task starts failing.
- Embedding calls, which `search` makes and does not record in `ai_usage`.
- A live view. The page shows what is recorded when it is opened or reloaded.

## References read

- 9router v0.5.99 (`.tmp/9router`): `src/app/(dashboard)/dashboard/usage`, the Overview and Details tabs and the request-details API's filters.
- MemoryOS `origin/main`: `docs/specs/ai-usage.md` (the ledger, the pricing formula, "unknown cost stays unknown", "estimates, not invoices") and `web/src/features/usage/ai-costs-page.tsx`.
- This repository: `AiUsageRepository`, `UsageRecorder`, `DocumentPages`, the audit log and MCP activity pages.
