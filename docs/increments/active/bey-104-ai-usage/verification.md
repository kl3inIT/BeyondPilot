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

## To check on staging after the merge

- Admin › AI › Usage on "30 days": the totals against the same counts read from `ai_usage`.
- A call that fails after the deploy shows its kind and its status in the log; the failures of 9 October, written before the status was kept, read "Failed".
