# AI usage: plan

Design: [design.md](design.md). Tracked in Linear as BEY-104.

| #   | Step                                                                                                                                                                                                                                                                | State   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | This design and plan                                                                                                                                                                                                                                                | Done    |
| 2   | Đạt's two decisions: recording the HTTP status of a failed call, and how the layout is approved                                                                                                                                                                     | Waiting |
| 3   | Backend: the reads in `AiUsageRepository` with the cost formula; `AiUsageReports`; the four endpoints; `error_status` if agreed, with its migration (the next free version, checked against `origin/main` right before the merge); `openapi.yml` and the web client | Waiting |
| 4   | Web: the route and the sidebar entry; the Overview with its totals, two charts and table; the Calls log with its filters and pages; messages in English and Vietnamese; end-to-end tests at desktop and mobile widths, with axe                                     | Waiting |
| 5   | `docs/specs/ai.md` and `docs/tests/ai.md` brought in line; `verification.md`                                                                                                                                                                                        | Waiting |

One branch and one pull request, made of small commits in the order above.

## Verification

- `./gradlew :backend:check`. The `ai` tests speak HTTP against PostgreSQL, with usage rows written for the test:
  - only operators read the usage;
  - the totals count calls, succeeded and failed, tokens, and the cost by the formula, with cached input at the cached price and at the input price where there is none;
  - a call without a price adds to "unknown cost" and nothing to the cost; a failed call adds a call and no cost; an OCR call costs its price per 1,000 calls divided by 1,000;
  - the series has one entry a day in `Asia/Ho_Chi_Minh`, days without calls included;
  - the breakdown groups by task, model and provider as the rows named them;
  - the log is newest first, pages, and filters by task, provider, model, outcome and dates; a period over 92 days and a page over 100 are refused;
  - a failed call keeps the status the provider answered with, and none when it did not answer.
- `pnpm --dir web check` and the end-to-end tests of Admin › AI › Usage.
- On staging: open the page and compare its totals for 9 October with the same counts read from the database.

## Needed from outside the code

| What                                               | For               | Where it is managed |
| -------------------------------------------------- | ----------------- | ------------------- |
| Đạt's two decisions and the approval of the layout | Step 3 and step 4 | Đạt                 |
