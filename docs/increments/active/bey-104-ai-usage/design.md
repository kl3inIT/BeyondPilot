# AI usage: every call in a log, with what succeeded, what failed and what it cost

Status: accepted on 9 October 2026 ([plan](plan.md)). Tracked in Linear as BEY-104. It adds a screen and read-only endpoints to the `ai` module; no new module and no new dependency between modules, so there is no boundary discovery.

The layout is the Figma section "Admin — AI: usage (draft for review, BEY-104)" on the Screens page. Đạt accepted it on 9 October as the draft to build from, to be corrected where building shows it does not hold; a correction is written here in the change that makes it.

## What it does

Every call to a chat model or an OCR service already leaves a row in `ai_usage` ([BEY-92](../bey-92-ai-models/design.md) started it, [BEY-102](../bey-102-document-reading-ocr/design.md) added OCR calls, [BEY-103](../bey-103-prices-follow-the-catalog/design.md) the price in effect). Nothing shows those rows. On 9 October the reader of document pages failed about once a minute for over an hour, 93 calls, and it was found only by reading the staging database.

Operators get a page, **Admin › AI › Usage**, with a period switch and two tabs.

| Tab      | What an operator sees                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| Overview | What is failing now, totals for the period, one chart of calls over time, and a table of where the calls went |
| Calls    | The log: one row a call, newest first, with filters and pages. A failed call says what kind of failure it was |

It is modelled on two screens the team knows: 9router's Usage page (an overview and a request log) and MemoryOS's "AI costs" (totals, a chart, breakdowns, unknown cost counted apart), kept to what BeyondPilot has.

## Domain story

1. An operator opens Admin › AI › Usage. The Overview shows today. An alert at the top says reading documents is failing on one model: 93 of its 412 calls, the last at 14:24.
2. Under it the totals: 1,576 calls, 6.5% failed, the tokens, an estimated cost from the 319 calls with a known price, and 1,154 calls whose price is unavailable. (The figures are staging's for 9 October.)
3. The chart of calls by hour shows the failures between 12:00 and 15:00. The table below says which model, task and provider took the calls.
4. They press "See the failed calls" and land on the Calls tab, filtered to failed calls of that task and model: one a minute, each with its kind of failure and the deck it was reading.
5. They change the reader in the OCR tab, come back, and see the calls succeed and the alert gone.

Failure and recovery:

- **No call in the period:** the page says so in place of the totals, the chart and the table, and suggests a longer period.
- **A call was made without a known price:** it counts under "Prices unavailable" and adds nothing to the cost. The cost shown is then a lower bound, and its tile says how many calls it is computed from.
- **A provider or a model was removed since:** its rows stay, under the name they were recorded with.

## Glossary

| Term              | Meaning                                                                                                                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Call              | One row of `ai_usage`: one request to a chat model or an OCR service                                                                                                                                                                                |
| Outcome           | `ok` or `failed`, as the row keeps it                                                                                                                                                                                                               |
| Kind of failure   | What a failed call was, for a person: the key was refused, the provider limited calls, the request was too large, the provider refused the request, the provider failed, it did not answer, or something else. See [below](#what-a-failed-call-was) |
| Estimated cost    | What a call would cost at the price recorded with it. Not an invoice                                                                                                                                                                                |
| Price unavailable | A call that answered and was recorded without a price. Counted apart, never as zero                                                                                                                                                                 |
| Subject           | What a call was about, as the caller named it: a solution's deck, a matching run                                                                                                                                                                    |
| Period            | Today, the last 7 days or the last 30 days, in `Asia/Ho_Chi_Minh`, the zone the screens show. The 7 and 30 days include today                                                                                                                       |
| Failing           | A task on a model is failing when, in the last 24 hours, at least 5 of its calls failed and they are at least 10% of its calls. It is judged on the last day whatever period the page shows: the alert says what is wrong now                       |

## What a call costs

Computed when read, from what the row keeps; nothing is stored.

| Call                     | Cost                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A chat model, priced     | `(input − cache read) × input price + cache read × cached price + output × output price`, per million tokens. Without a cached price, cached input costs the input price. This is MemoryOS's formula, for usage where the input count includes the cached tokens, as OpenAI reports it. Spring AI's `Usage` gives Anthropic's input without the part read from or written to a cache (read in `AnthropicChatModel` 2.0.1), so `UsageRecorder` adds them: `input_tokens` is the whole input for every provider |
| An OCR service, priced   | `price per 1,000 calls ÷ 1,000`, for a call that answered                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Any call without a price | Unavailable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| A failed call            | Nothing: a provider does not bill a call it refused. It still counts as a call, and not as one whose price is unavailable                                                                                                                                                                                                                                                                                                                                                                                     |

Whether a failed call is billed differs by provider and by failure; counting it as nothing keeps the estimate from overstating. The page states that costs are estimates from the usage providers report and from list prices, and that a gateway on a subscription, such as 9Router, is not billed by the token at all.

## What a failed call was

A failed row keeps the class of the exception (`error_type`) and, from this increment, the HTTP status the provider answered with (`error_status`). The kind shown is derived when read, by the first rule that fits:

| The row has                                    | Kind                             |
| ---------------------------------------------- | -------------------------------- |
| Status 401 or 403                              | The key was refused              |
| Status 429                                     | The provider limited calls       |
| Status 413                                     | The request was too large        |
| Any other status from 400 to 499               | The provider refused the request |
| Status 500 or above                            | The provider failed              |
| No status, and the class of a timeout          | The provider did not answer      |
| Neither (every failed row written before this) | The call failed                  |

The log shows the kind, with the status beside it when there is one. The exception's message is never stored or shown: it can carry the provider's text.

## Data and invariant owner

`ai` owns `ai_usage` and stays its only writer.

| Table      | Change                                                                                                                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai_usage` | Gains `error_status`, the HTTP status of a failed call where the provider answered with one; null for a call that answered, for a failure without a status (a timeout), and for every row written before |

Rows written before are not filled in: 9 October's 93 failures stay "The call failed", although they are known to have been 413.

No rollup table. `ai_usage` is indexed by time and by task, and the volume is small: staging wrote 1,576 rows on 9 October, the day matching and document reading first ran in earnest. The endpoints bound what they read: a period of at most 30 days, and a page of 50 calls.

## How it is built

- **`AiUsageRepository`** gains the reads, in SQL: totals for a period, the tasks failing in it, a series by hour or by day, a breakdown by model, task or provider, and a page of calls with filters. Costs are computed in SQL with the formula above.
- **`AiUsageReports`**, an application service of `ai`, checks the operator, turns a period into its two instants and answers the records. Read-only.
- **Endpoints** under `/api/ai/admin/usage`, each taking `period` (`today`, `7d`, `30d`):

  | Endpoint   | Answers                                                                                                                                                                                                                                                          |
  | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `overview` | Takes `by` (`model`, `task`, `provider`). The totals; what is failing; succeeded and failed for each hour of today so far, or each day of the 7 or 30, those without calls included; and the breakdown, where a row by model is a model on a provider for a task |
  | `calls`    | Takes `task`, `provider`, `model`, `outcome` and `page`. Fifty calls a page, newest first, with the total and the tasks, providers and models called in the period, to filter by                                                                                 |

  The Overview is one read because the page shows it whole; the first plan had four.

- **`error_status`** is filled by `UsageRecorder` from the first exception in the chain of causes that carries a status, and by `DocumentPages` for an OCR call, whose adapter's exception then says the status it met.
- **Web:** `web/src/features/ai`, a route `/admin/ai/usage` with the Calls tab at `/admin/ai/usage/calls`, as the MCP pages have their tabs, and an entry "Usage" in the admin sidebar under AI. The period and the filters live in the address, read on the server as the MCP activity page reads its own. The chart is Recharts through the installed shadcn `chart` primitive, which no screen uses yet; the period and dimension switches are the installed `toggle-group`; the alert, the table, the empty state and the pages reuse what the audit log and the MCP activity page use.

## Screen

The page head carries the title and the period switch: Today, 7 days, 30 days. The switch holds for both tabs.

**Overview**, top to bottom:

1. An alert for what is failing, when something is: the task and the model, how many of its calls failed, when the last one was and its kind, with "See the failed calls" under it. When several are failing, the one with the most failures is named and the alert says how many others there are.
2. Five totals in a row, two a row at phone width: Calls (succeeded and failed under it), Failure rate, Tokens (in and out), Estimated cost ("From the n calls with a known price"), Prices unavailable (with a link to the model prices). The last is left out when every call had a price.
3. One chart, **Calls by hour** for today and **Calls by day** otherwise: bars stacked as succeeded and failed, with a value axis.
4. **Where the calls went**, with a switch between Model, Task and Provider: a share bar, calls, failed, failure rate, tokens, average time and estimated cost a row, sorted by calls. A row opens its calls in the log. At phone width the rows are stacked.
5. One line of small print: what "estimated" means.

**Calls**:

1. Filters in one bar: task, provider, model, outcome (All, Succeeded, Failed).
2. A table, newest first: time, task, model with its provider under it, tokens in and out, duration, cost, and what the call was about as a link with its kind under it. Only a failed row carries a badge, with its kind of failure in place of the tokens. A cost that is unavailable is a dash. Below 768px, stacked rows.
3. Pages of 50, with "1–50 of n calls".

The chart carries its numbers as text as well: the totals and the table hold the same figures, and the chart has a short description for a screen reader.

## Decisions

| Decision                                             | Why                                                                                                                                                                               |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A page of its own, not a line on each task's row     | A line would say a task is failing; it would not show which calls, since when, or what they cost. Đạt asked for the log and the statistics, as 9router has them                   |
| What is failing leads the Overview                   | It is why the page exists. In the first draft 9 October's failures were a red band in a chart                                                                                     |
| One chart, of calls; none of cost                    | On 9 October 1,154 of 1,576 calls had no known price. A chart of cost over time would draw almost nothing and look like a low bill                                                |
| Three periods, no dates to type                      | Both references offer presets. Three presets answer "is it failing now" and "what did the month take"; a range of dates is added when someone needs a day that is not today       |
| No comparison with the period before                 | MemoryOS shows one for spending against a budget. Here the cost is mostly unknown, and a change in the count of calls says only that matching ran                                 |
| The HTTP status of a failed call is recorded         | Without it 9 October's failures read `UnexpectedStatusCodeException` where the status was 413, and a request refused for its size cannot be told from a provider that is down     |
| No prompt, no answer and no error message in the log | They are not stored, by BEY-92's decision: they can hold customers' data and a provider's text. 9router keeps them because it is one person's tool                                |
| A call without a price is unavailable, never zero    | MemoryOS's rule. The first calls on staging were recorded before their models had a price; counted as zero they would make the total look complete                                |
| Costs are computed when read, not stored             | The row keeps the tokens and the prices of its time, which is all the formula needs. A stored cost would have to be recomputed if the formula were corrected                      |
| No rollup table                                      | MemoryOS rolls up by day because limits block on its totals and it serves many people. Here some thousand rows a day are counted directly                                         |
| Recharts through the shadcn chart primitive          | Both are installed. The primitive gives the chart the design tokens and the tooltip of the rest of the screens                                                                    |
| A fallback model per task (BEY-101) is put aside     | The 93 failures were a request the gateway refused for its size, which another model would have refused too, and they were fixed at the request. What was missing was seeing them |

## Left out

- Usage by person or group, spending limits and exported reports, which MemoryOS has: no end user calls a model here yet.
- A notification when a task starts failing. The alert is on the page, for someone who opens it.
- Embedding calls, which `search` makes and does not record in `ai_usage`.
- A live view. The page shows what is recorded when it is opened or reloaded.
- A range of dates, and a comparison with the period before.

## References read

- 9router v0.5.99 (`.tmp/9router`): `src/app/(dashboard)/dashboard/usage`, the Overview and Details tabs and the request-details API's filters.
- MemoryOS `origin/main`: `docs/specs/ai-usage.md` (the ledger, the pricing formula, "unknown cost stays unknown", "estimates, not invoices") and `web/src/features/usage/ai-costs-page.tsx`.
- This repository: `AiUsageRepository`, `UsageRecorder`, `DocumentPages`, the audit log and MCP activity pages.
