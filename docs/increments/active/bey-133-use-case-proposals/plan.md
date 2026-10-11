# BEY-133: plan

Design: [design.md](design.md). Tracked in Linear as BEY-133.

| #   | Step                                                                                                                                                                                                                         | State |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | Published reads in other modules: `UseCaseDirectory.target`, `TalentSnapshots`                                                                                                                                               | Open  |
| 2   | Migration `V74`, entities and repositories, `UseCaseProposals` service, error codes, the merge listener                                                                                                                      | Open  |
| 3   | `UseCaseProposalsController`, DTO records, `package-info.java` and `ModulithArchitectureTest` for the two new edges, `openapi.yml` and the generated client                                                                  | Open  |
| 4   | Backend tests: service rules, HTTP, the count, authorization of the reader, the merge                                                                                                                                        | Open  |
| 5   | Web: the wizard, the use case page entry and count, the organization's list and one proposal, the Proposals column and menu item, both catalogs, unit tests and the Playwright spec                                          | Open  |
| 6   | Documents: `docs/specs/proposal.md`, `docs/tests/proposal.md`, `ARCHITECTURE.md`, the roadmap                                                                                                                                | Open  |
| 7   | Gates: `./gradlew :backend:check`, `pnpm --dir web check`, `pnpm --dir web test:e2e`; then the pull request                                                                                                                  | Open  |

## Later

Withdrawing a sent proposal; shortlist and decline; email to the sender and the team; operator views; bundles for 1024 and 390 widths of the new screens if the Figma frames are drawn.

## Verification

- `./gradlew :backend:check`
- `pnpm --dir web check` and `pnpm --dir web test:e2e`
