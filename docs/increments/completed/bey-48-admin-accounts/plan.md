# BEY-48 — plan

Design: [design.md](design.md). Tracked in Linear as BEY-48; one branch, one pull request, a commit per step.

| #   | Step                                                                                                                                                                                                                        | State                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 0   | Research and the screens in Figma (section `Admin — Accounts`), approved on 4 October 2026                                                                                                                                  | Done                 |
| 1a  | Backend: the `audit` module: `V2__audit_event.sql` (append-only), `AuditTrail`, the action catalog with declared details, its tests, and the module in `ModulithArchitectureTest`                                           | Done, 4 October 2026 |
| 1b  | Backend: `requireOperator`, the list (`AccountQueryRepository`), the four commands with their rules and audit events, the failure codes, `IdentityAccountsTest`, `openapi.yml` and the generated web client                 | Done, 4 October 2026 |
| 2   | Web pieces that arrive with this screen: nuqs and its adapter, the `DataTable` composite on the registry `table`, the confirmation hook on `alert-dialog`, the toast helper that takes message keys, the `Status` component | Done, 4 October 2026 |
| 3   | Web: `/admin/accounts` at the three widths, the row menu and the three confirmations, the no-results state, the Accounts destination in the sidebar, both catalogs, the stub backend and the Playwright spec                | Done, 4 October 2026 |
| 4   | Figma: `Avatar`, `Status` and the pagination links as components, and the Accounts frames rebuilt from them; `docs/figma-component-map.md`; `docs/tests/identity.md`; the conventions for lists and composites; the roadmap | Done, 4 October 2026 |

Decided on 4 October 2026: the audit record is a table from the start, and the list is server-rendered on the registry `table` without TanStack Query or TanStack Table. An ADR for the `audit` module and the `identity → audit` edge is written once step 1a starts.

## Verification

- `./gradlew :backend:check`
- `pnpm --dir web check` and `pnpm --dir web test:e2e`
- By hand against the local stack: sign in as an operator, disable a second account and watch its session stop in another browser; make it an operator and withdraw the role; search and filter.
