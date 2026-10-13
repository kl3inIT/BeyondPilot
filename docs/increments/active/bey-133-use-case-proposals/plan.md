# BEY-133: plan

Design: [design.md](design.md). Tracked in Linear as BEY-133.

| #   | Step                                                                                                                                                                                | State |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | Published reads in other modules: `UseCaseDirectory.target`, `TalentSnapshots`                                                                                                      | Open  |
| 2   | Migration `V78`, entities and repositories, `UseCaseProposals` service, error codes, the merge listener                                                                             | Open  |
| 3   | `UseCaseProposalsController`, DTO records, `package-info.java` and `ModulithArchitectureTest` for the two new edges, `openapi.yml` and the generated client                         | Open  |
| 4   | Backend tests: service rules, HTTP, the count, authorization of the reader, the merge                                                                                               | Open  |
| 5   | Web: the wizard, the use case page entry and count, the organization's list and one proposal, the Proposals column and menu item, both catalogs, unit tests and the Playwright spec | Open  |
| 6   | Documents: `docs/specs/proposal.md`, `docs/tests/proposal.md`, `ARCHITECTURE.md`, the roadmap                                                                                       | Open  |
| 7   | Gates: `./gradlew :backend:check`, `pnpm --dir web check`, `pnpm --dir web test:e2e`; then the pull request                                                                         | Open  |

## Apply v5 follow-up (2026-10-13)

- Implemented, verification pending: separate organization team background, migration V89, profile/dialog fields and conditional validation, versioned basics saves, proposal background defaults without rewriting existing submissions.
- Implemented, verification pending: finder-first organization selection, quick-create for all types, pending-request withdrawal, no deferred organization creation on Continue.
- Implemented: TanStack Query organization context scoped to the wizard, opening-time dialog reads, mutation refetch, preserving TanStack Form draft values.
- Verified: frontend lint, formatting, message/failure-code catalogs, knip, 644 frontend unit tests with two workers; backend compilation, team-background validation tests and migration-version checks without PostgreSQL.
- Verified locally: application-generated OpenAPI and SDK drift check, the full backend gate (469 tests), and the full web gate (644 unit tests). All 14 proposal browser tests pass on desktop and mobile, including quick-create validation, versioned organization editing, and withdrawing a pending request. The complete browser suite and GitHub CI must pass before merging.

## Later features

Withdrawing a sent proposal; shortlist and decline; email to the sender and the team; operator views; bundles for 1024 and 390 widths of the new screens if the Figma frames are drawn.

## Verification

- `./gradlew :backend:check`
- `pnpm --dir web check` and `pnpm --dir web test:e2e`
