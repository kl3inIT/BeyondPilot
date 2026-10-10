# AI usage: verification

Design: [design.md](design.md). Plan: [plan.md](plan.md).

## Run on 9 October 2026, on the development machine

| Check                                                                                         | Result                                                                                                       |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `AiUsageReportsTest` (8 tests), `AiAdministrationTest` (15), `OcrAdministrationTest` (8)      | No failure                                                                                                   |
| `OpenApiContractTest`, `ModulithArchitectureTest`                                             | No failure; `openapi.yml` and the web client regenerated                                                     |
| `pnpm --dir web check`                                                                        | Passed: the client drift check, ESLint, Prettier, `tsc`, 86 unit tests, the message catalogs, knip           |
| `pnpm --dir web test:e2e admin-ai-usage admin-ai.spec admin.spec`                             | 36 passed, 2 skipped, on desktop and mobile Chrome with axe                                                  |
| The pages drawn from the production build with the stub's figures, at 1280 and at phone width | Read against the Figma draft; the fifth total left an empty cell at phone width and was made to fill its row |

## Not run on the development machine

The whole of `./gradlew :backend:check` and the whole end-to-end suite: the machine is short of memory. CI runs both on the branch.

## On staging, 10 October 2026

Pull request #165 was merged on 9 October with every check green, and staging runs it (migration `V69`).

| Check                                                                 | Result                                                                                                                                                                                                          |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The page's own queries run against staging's `ai_usage`, last 30 days | 1,691 calls, 127 failed, an estimated 2.18 US dollars from 410 priced calls, 1,154 with the price unavailable; by model `aihay` 957 calls and 9 failed, `cx/gpt-6-luna` 412 and 93, `cx/gpt-6.1-sol` 322 and 25 |
| The status of a failed call                                           | All 24 calls that failed after the deploy carry 503, from 9Router on matching between 23:16 on 9 October and 00:10 on 10 October; the failures written before stay without a status                             |
| The page as a signed-in operator sees it                              | Opened and accepted by Đạt                                                                                                                                                                                      |

## Left for later

In Figma, the admin sidebar has no "Usage" entry and the frames of the section "Admin — AI: usage" are the draft, not what was built: a failed call is a dot and a label, not a badge, and what is failing is judged on the last 24 hours.
