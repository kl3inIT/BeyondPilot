# Solution demo and deck links, and approved-but-unlisted solutions: plan

Design: [design.md](design.md). Tracked in Linear as BEY-34.

| #   | Step                                                                                                                                              | State |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | The next free migration: `demo_url` and `deck_url` on `solution`; the entity, `SaveSolutionRequest`, `SolutionResponse`, `PublicSolutionResponse` | Done  |
| 2   | `SolutionDirectory.get` answers for any approved solution and says whether it is listed; `listedAt` becomes `approvedAt` for `introduction`       | Done  |
| 3   | `SolutionTest` and the matrix in `docs/tests/solution.md`; `openapi.yml` and the generated web client; `./gradlew :backend:check`                 | Done  |
| 4   | Web: the two fields in the editor, the links on the public page, the unlisted notice and `noindex`, both catalogs                                 | Done  |
| 5   | End-to-end tests for the editor fields and an unlisted page; `pnpm --dir web check`                                                               | Done  |
