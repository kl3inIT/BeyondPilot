# BEY-129 — plan

Design: [design.md](design.md). Tracked in Linear as BEY-129.

| #   | Step                                                                                                                                                                      | State                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 1   | Backend: `V74__program_question_multi_choice.sql`, the kind in `program` (options as `single_choice`), the answer checked and kept by `ProposalService`, with their tests | Done, 11 October 2026 |
| 2   | Contract: `openapi.yml` and the generated web client                                                                                                                      | Done, 11 October 2026 |
| 3   | Web: "Several choices" in the question editor, the group of checkboxes in the application form, the three read-backs, both catalogs, the stubs and the Playwright specs   | Done, 11 October 2026 |
| 4   | Documents: the program and proposal specifications and their test matrices                                                                                                | Done, 11 October 2026 |
| 5   | On staging: add a question of several choices to a program whose applications have not opened, answer it, submit, and read it as applicant, operator and judge            | Open                  |
| 6   | Move this increment to `completed`                                                                                                                                        | Open                  |

## Verification

- `./gradlew :backend:check`
- `pnpm --dir web check` and `pnpm --dir web test:e2e`
- Step 5, on staging after the merge.
