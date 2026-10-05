# Introduction requests on a solution: plan

Design: [design.md](design.md). Tracked in Linear as BEY-34.

| #   | Step                                                                                                                                                                     | State |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| 1   | `organization.ownersOf` and `solution.listedAt`, each returning the little the new module needs                                                                          | Open  |
| 2   | The next free migration after `V9`; the `introduction` module: request, list, reply and decline in `IntroductionService`, its controllers, `IntroductionErrorCode`       | Open  |
| 3   | The emails: the request to the owners, the introduction to both sides on a reply, the notice of a decline; `AuditAction` entries                                         | Open  |
| 4   | The module in `ModulithArchitectureTest`; `openapi.yml` and the generated web client                                                                                     | Open  |
| 5   | `IntroductionTest` over HTTP, and the matrix in `docs/tests/introduction.md`; `./gradlew :backend:check`                                                                 | Open  |
| 6   | Web: the dialog and the "request sent" state on the solution page, the Introductions tab and list, both message catalogs                                                 | Open  |
| 7   | End-to-end tests in `web/tests/e2e` for the dialog, its refusals and the list; `pnpm --dir web check`                                                                    | Open  |
| 8   | The documents that describe what exists: `ARCHITECTURE.md` or the specs, and the known limits of [BEY-33](../bey-33-organization-solution-talent/design.md#known-limits) | Open  |

## Verification

To be filled in as the steps are done.
