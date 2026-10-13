# Admin home: verification

Design: [design.md](design.md). Plan: [plan.md](plan.md).

## Run on 13 October 2026, on the development machine

| Check                                                                                                                                                                            | Result                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The four queue tests (`TalentTest`, `SolutionTest`, `OrganizationTest`, `UseCaseAdministrationTest`, `theQueueCountsWhatWaitedAtTheEndOfEachOfTheLast14Days`) against PostgreSQL | No failure                                                                                                                                                                     |
| `./gradlew :backend:check`                                                                                                                                                       | Passed                                                                                                                                                                         |
| `OpenApiContractTest` with `BEYONDPILOT_OPENAPI_WRITE=true`, then `pnpm generate:api`                                                                                            | `openapi.yml` and the web client regenerated with the five `queue` reads                                                                                                       |
| `pnpm --dir web check`                                                                                                                                                           | Passed: the client drift check, ESLint, Prettier, `tsc`, 644 unit tests, the message catalogs, knip. On the last run knip crashed for want of memory on the machine; CI ran it |
| `pnpm --dir web exec playwright test admin.spec.ts admin-ai-usage.spec.ts`, desktop and mobile, each test five times                                                             | 110 passed, with axe                                                                                                                                                           |

## Found on the way

- The account-menu test failed on a phone once the home was taller than the screen; see the [plan](plan.md#found-on-the-way). Pointed at Admin › AI › Usage, the same test on main failed 7 times in 8.
- The sparkline's chart was focusable (Recharts 3 turns its accessibility layer on by default) inside an element hidden from assistive technology; axe failed it as `aria-hidden-focus`. Its layer is off.
- The queue test of `talent` first approved a listed profile with the skill the directory test searches for, which pushed that test's profiles off the first page in CI. It approves an unlisted one.

## CI and review

Pull request #283 merged on 13 October with every check green. Two end-to-end shards and one backend run were run again: the first backend failure was the talent test above, the second end-to-end failure an axe `target-size` finding in the use-case wizard, which main passes and this change does not touch. CodeRabbit asked for three changes: five cells a row from 1280px and one row from the email log were made; formatting the email counts was not, because next-intl already formats a number given to a plain placeholder.

## On staging, 13 October 2026

Signed in as an operator at beyondpilot.vadan.app, after the deploy of `e3609ff7`.

| Check                              | Result                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The home at 1440px, light and dark | 275 records waiting: 1 solution (oldest 1 day), 274 organizations (oldest 18 days, the imported ones), no use case, talent profile or deployment; each queue with its 14 days. Two programs with applications (1 of 3 and 0 of 21 assessed); 2,195 AI calls in 7 days, 6% failed; 28 emails, 26 delivered; 2,160 records in the search index |
| The home at 1024px and 390px       | No sideways scroll. At 390px two cells a row and no small charts. At 1024px the fifth cell left an empty slot in its row of three; it now fills the rest of the row                                                                                                                                                                          |
