# BEY-130 — plan

Design: [design.md](design.md). Tracked in Linear as BEY-130.

| #   | Step                                                                                                                                                                                                                                                                     | State                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| 1   | Backend: `V74__solution_add_pinned_at.sql`, `V75__talent_add_pinned_at.sql`, pin and unpin in `SolutionAdministration` and `TalentAdministration`, the four audit actions, the order of the two public lists, `pinnedAt` and the `pinned` filter in the operators' lists | Done, 11 October 2026 |
| 2   | Contract: `openapi.yml` and the generated web client                                                                                                                                                                                                                     | Done, 11 October 2026 |
| 3   | Web: the action on both record screens and in the solutions list's row menu, the Pinned mark, the Pinned filter, the audit log's actions, both catalogs, the stubs and the Playwright specs                                                                              | Done, 11 October 2026 |
| 4   | Documents: the test matrices, the audit specification, `ARCHITECTURE.md`, the roadmap                                                                                                                                                                                    | Done, 11 October 2026 |
| 5   | On staging: pin two solutions and two profiles, read both directories under each order and on page 2, unpin one                                                                                                                                                          | Open                  |
| 6   | GenAI Fund names the records to pin; then move this increment to `completed`                                                                                                                                                                                             | Open                  |

## Verification

- `./gradlew :backend:check`
- `pnpm --dir web check` and `pnpm --dir web test:e2e`
- Step 5, which no stub replaces: the Playwright specs answer from a stub that does not order anything, so the order of the public lists is proved by `SolutionTest` and `TalentTest` against PostgreSQL and seen on staging.
