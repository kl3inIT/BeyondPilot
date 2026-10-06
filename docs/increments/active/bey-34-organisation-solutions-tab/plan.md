# An organization's solutions in its admin record: plan

Design: [design.md](design.md). Tracked in Linear as BEY-34.

| #   | Step                                                                                                                               | State                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | The operators' list of solutions narrows by `organization`, and `AdminSolutionSummaryResponse` carries `organizationId`            | Done                                                                                   |
| 2   | `SolutionTest` and the matrix in `docs/tests/solution.md`; `openapi.yml` and the generated web client                              | Written; `openapi.yml` was edited by hand, so the backend check in CI is its first run |
| 3   | Web: the tabs of the organization's record, and the Solutions tab with the list, the open solution and the decision; both catalogs | Built; `typecheck` and the end-to-end suite run in CI                                  |
| 4   | Web: the organization's name in the operators' list and in a solution's decision panel leads to the tab at that solution           | Done                                                                                   |
| 5   | An end-to-end test that opens the tab, walks to the next solution that waits and decides                                           | Todo                                                                                   |
| 6   | Figma: the organization's record with its tabs and the Solutions tab at 1440, 1024 and 390                                         | Todo                                                                                   |
| 7   | The Profile of the prototype, after BEY-61 lands: the overview, and the operators' actions the organization module then offers     | Todo                                                                                   |
