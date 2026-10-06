# The operators' review of solutions: plan

Design: [design.md](design.md). Tracked in Linear as BEY-66.

| #   | Step                                                                                                                                                              | State |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | The next free migration: `submitted_by_account_id` on `solution`; `Solution.submit` records the account                                                           | Done  |
| 2   | `OrganizationDirectory` answers the organizations whose name contains a text; the operators' list matches by it, narrows by industry and counts what waits        | Done  |
| 3   | `AdminSolutionSummaryResponse` with the sender and industries; `SolutionResponse` names the sender                                                                | Done  |
| 4   | `SolutionTest` and the matrix in `docs/tests/solution.md`; `openapi.yml` and the generated web client; `./gradlew :backend:check`                                 | Done  |
| 5   | Web: the queue with the count of what waits, the industry filter, the new columns and a larger way into a row; both catalogs                                       | Done  |
| 6   | Web: the record as labelled rows with what is missing said, the decision panel that stays in view, the deployments that wait                                      | Built; `typecheck`, the end-to-end tests and a walk in the browser are still to run |
| 7   | Figma: the review record at 1440, 1024 and 390 gains `Why it is worth it`, `Website`, `Organization` and `Directory`; the queue frames are still to align                  | Record done; queue todo |
