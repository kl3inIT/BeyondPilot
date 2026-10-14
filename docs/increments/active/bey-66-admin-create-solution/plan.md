# An operator creates and publishes a solution: plan

Design: [design.md](design.md). Tracked in Linear as BEY-66.

| #   | Step                                                                                                                                                                                              | State                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | Audit actions `solution.create` and `solution.publish`; `AdminCreateSolutionRequest`; `SolutionService` keeps the writing of a save and the start of a draft in one method each, for both callers | Done                                                                     |
| 2   | `SolutionAdministration`: organizations to start for, create, read a draft, save a draft, publish; the five endpoints on `AdminSolutionsController`                                               | Done                                                                     |
| 3   | `SolutionTest` case and the matrix in `docs/tests/solution.md`; `openapi.yml` and the generated web client                                                                                        | Done; the whole `./gradlew :backend:check` is still to run               |
| 4   | Web: `SolutionEditor` takes `operator` (its calls, its way out, `Publish`, no customer deployments); the operators' page at `/admin/solutions/[id]/edit`                                          | Built                                                                    |
| 5   | Web: `Create solution` dialog on `/admin/solutions`, both catalogs, the end-to-end test; `pnpm --dir web check`                                                                                   | Built; the end-to-end run and `pnpm --dir web check` are still to finish |

Run the backend tests with `JAVA_TOOL_OPTIONS=-Duser.timezone=Asia/Ho_Chi_Minh` on a machine whose JVM zone is `Asia/Saigon`: PostgreSQL 18 refuses that name.
