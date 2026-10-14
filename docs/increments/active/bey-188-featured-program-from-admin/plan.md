# BEY-188 — plan

Design: [design.md](design.md). Tracked in Linear as BEY-188. Steps 2 to 5 share one branch and one pull request.

| #   | Step                                                                                                                                                                                                                | State |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | This design and plan; Đạt's approval of the decisions, the second row of dates among them                                                                                                                           | Open  |
| 2   | Backend: the migration with Nestlé featured, `feature` and `unfeature`, the `featured` filter of the public list, `featuredAt` in Admin's records, the audit actions; `openapi.yml` and the generated client; tests | Open  |
| 3   | Web, Admin: the ⋯ menu items with Undo, the Featured badge on the program's screen and in the list, the audit log's actions; both catalogs                                                                          | Open  |
| 4   | Web, home page: the announcement reads the featured program; the constants and the program's words in `Home.featured` go; the stubs and the Playwright specs                                                        | Open  |
| 5   | Documents: `docs/specs/program.md`, `docs/specs/audit.md`, `docs/tests/program.md`, the roadmap                                                                                                                     | Open  |
| 6   | Staging: feature a program with a cover, a partner and an event; open the home page in a fresh browser at 390 and 1280 pixels; feature another and see it replace the first; stop featuring it; check the audit log | Open  |
| 7   | Production: after the release, the announcement still shows Nestlé, with its cover and dates                                                                                                                        | Open  |

## Verification

- `./gradlew :backend:check`: featuring twice and stopping twice change nothing and record nothing; a non-operator is refused; `featured=true` returns only featured published programs, the latest featured first; saving the settings after featuring keeps `featured_at` and is not refused for its version.
- `pnpm --dir web check` and `pnpm --dir web test:e2e`: the announcement shows the program the stub answers with, shows nothing when the stub answers none or a closed one, and the Admin action toggles the badge and undoes.
- Step 6 and 7, which no stub replaces: the minute the home page keeps its read, and the real cover.
