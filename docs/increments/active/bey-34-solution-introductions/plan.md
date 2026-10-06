# Introduction requests on a solution: plan

Design: [design.md](design.md). Tracked in Linear as BEY-34.

| #   | Step                                                                                                                                                                     | State |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| 1   | `organization.ownersOf` and `solution.listedAt`, each returning the little the new module needs                                                                          | Done  |
| 2   | The next free migration after `V9`; the `introduction` module: request, list, reply and decline in `IntroductionService`, its controllers, `IntroductionErrorCode`       | Done  |
| 3   | The emails: the request to the owners, the introduction to both sides on a reply, the notice of a decline; `AuditAction` entries                                         | Done  |
| 4   | The module in `ModulithArchitectureTest`; `openapi.yml` and the generated web client                                                                                     | Done  |
| 5   | `IntroductionTest` over HTTP, and the matrix in `docs/tests/introduction.md`; `./gradlew :backend:check`                                                                 | Done  |
| 6   | Web: the dialog and the "request sent" state on the solution page, the Introductions tab and list, both message catalogs                                                 | Done  |
| 7   | End-to-end tests in `web/tests/e2e` for the dialog, its refusals and the list; `pnpm --dir web check`                                                                    | Done  |
| 8   | The documents that describe what exists: `ARCHITECTURE.md` or the specs, and the known limits of [BEY-33](../bey-33-organization-solution-talent/design.md#known-limits) | Done  |
| 9   | Operators' list: `IntroductionAdministration`, `/api/introduction/admin/introductions`, `/admin/introductions`, the sidebar item, both catalogs, tests                   | Done  |

## Verification

- `./gradlew :backend:test` runs `IntroductionTest` (seven tests over real HTTP against PostgreSQL), `ModulithArchitectureTest` and `OpenApiContractTest`.
- `pnpm --dir web check` passes: API client in step with `openapi.yml`, lint, formatting, types, unit tests, catalog keys, unused exports.
- `pnpm --dir web test:e2e tests/e2e/introductions.spec.ts` passes on desktop and mobile Chrome, with axe on the sign-in link, the blocked dialog, the form, the owners' list and the decline confirmation.
