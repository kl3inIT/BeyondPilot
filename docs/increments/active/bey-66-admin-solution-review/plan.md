# The operators' review of solutions: plan

Design: [design.md](design.md). Tracked in Linear as BEY-66.

| #   | Step                                                                                                                                                              | State |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | The next free migration: `submitted_by_account_id` on `solution`; `Solution.submit` records the account                                                           | Done  |
| 2   | `OrganizationDirectory` answers the organizations whose name contains a text; the operators' list matches by it, narrows by industry and counts what waits        | Done  |
| 3   | `AdminSolutionSummaryResponse` with the sender and industries; `SolutionResponse` names the sender                                                                | Done  |
| 4   | `SolutionTest` and the matrix in `docs/tests/solution.md`; `openapi.yml` and the generated web client; `./gradlew :backend:check`                                 | Done  |
| 5   | Web: the queue with tabs, the count, the new columns and the row link; both catalogs                                                                              | Todo  |
| 6   | Web: the record as labelled rows with what is missing said, the decision panel that stays in view, the deployments that wait; `pnpm --dir web check`              | Todo  |
| 7   | Figma: the admin frames match the fields the backend has                                                                                                          | Todo  |
