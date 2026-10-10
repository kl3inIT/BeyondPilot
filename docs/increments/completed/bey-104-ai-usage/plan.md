# AI usage: plan

Design: [design.md](design.md). Tracked in Linear as BEY-104.

One branch and one pull request. Each step is one commit or a few small ones, pushed as it is finished, in this order.

| #   | Step                                                                                                                                                                                                                                                                                                                                             | State |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| 1   | The design and this plan; a Figma draft of the layout, accepted by Đạt on 9 October as the draft to build from                                                                                                                                                                                                                                   | Done  |
| 2   | **The status of a failed call.** The migration adding `ai_usage.error_status` (the next free version, checked against `origin/main` right before the merge); `UsageRecorder` and `DocumentPages` fill it. Before the cost formula is written: read how Spring AI's `Usage` counts Anthropic's cached input, and correct the design if it differs | Done  |
| 3   | **The reads.** `AiUsageRepository`: totals, what is failing, the series, the breakdown, the page of calls, with the cost in SQL. `AiUsageReports`. `AiUsageController` with `overview` and `calls`, and their records in `dto`. `openapi.yml` and the web client                                                                                 | Done  |
| 4   | **The page and the Overview.** The two routes, the sidebar entry, the page head with the period switch and the tabs; the alert, the totals, the chart, the table of where the calls went, the empty state. Messages in English and Vietnamese                                                                                                    | Done  |
| 5   | **The Calls log.** The filters, the table and its stacked rows, the pages; the links from the alert and from a row of the Overview                                                                                                                                                                                                               | Done  |
| 6   | End-to-end tests of both tabs at desktop and phone widths, with axe                                                                                                                                                                                                                                                                              | Done  |
| 7   | `docs/specs/ai.md` and `docs/tests/ai.md` brought in line; `verification.md`; in Figma, the "Usage" entry of the admin sidebar, and the frames corrected to what was built                                                                                                                                                                       | Done  |
| 8   | Merged when CI is green; checked on staging; the increment moved to `completed`                                                                                                                                                                                                                                                                  | Done  |

## Verification

- `./gradlew :backend:check`. The `ai` tests speak HTTP against PostgreSQL, with usage rows written for the test:
  - only operators read the usage;
  - the totals count calls, succeeded and failed, tokens, and the cost by the formula, with cached input at the cached price and at the input price where there is none;
  - a call that answered without a price adds to "price unavailable" and nothing to the cost; a failed call adds a call, no cost, and nothing to "price unavailable"; an OCR call costs its price per 1,000 calls divided by 1,000;
  - a task on a model is failing from 5 failed calls in the last 24 hours that are 10% of its calls, and not below either;
  - the series has one entry for each hour of today so far, and one a day for 7 and 30 days in `Asia/Ho_Chi_Minh`, those without calls included;
  - the breakdown groups by model, by task and by provider as the rows named them;
  - the log is newest first, pages, and filters by task, provider, model and outcome; an unknown period, grouping or page is refused;
  - a failed call keeps the status the provider answered with, and none when it did not answer; each status reads as its kind.
- `pnpm --dir web check` and the end-to-end tests of Admin › AI › Usage.
- On staging: open the page on "30 days" and compare its totals with the same counts read from the database; make a call fail and read its kind in the log.

## Needed from outside the code

Nothing. The page reads what is already recorded.
