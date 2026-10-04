# BEY-48 — plan

Design: [design.md](design.md). Tracked in Linear as BEY-48; one branch, one pull request, a commit per step.

| #   | Step                                                                                                                                                                                                         | State |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| 0   | Research and the screens in Figma (section `Admin — Accounts`), approved on 4 October 2026                                                                                                                   | Done  |
| 1   | Backend: `requireOperator`, the list (`AccountQueryRepository`), the four commands with their rules and log lines, the failure codes, `IdentityAccountsTest`, `openapi.yml` and the generated web client     | Open  |
| 2   | Web pieces that arrive with this screen: nuqs and its adapter, the confirmation hook on `alert-dialog`, the toast helper that takes message keys, the `Status` component                                     | Open  |
| 3   | Web: `/admin/accounts` at the three widths, the row menu and the three confirmations, the no-results state, the Accounts destination in the sidebar, both catalogs, the stub backend and the Playwright spec | Open  |
| 4   | Figma: `Status` as a component; `docs/figma-component-map.md`; `docs/tests/identity.md`; the conventions for the list contract and for URL state; the roadmap                                                | Open  |

Two decisions in the design wait for a yes before step 1: the record of sensitive changes as log lines for now, and this screen without TanStack Query and TanStack Table.

## Verification

- `./gradlew :backend:check`
- `pnpm --dir web check` and `pnpm --dir web test:e2e`
- By hand against the local stack: sign in as an operator, disable a second account and watch its session stop in another browser; make it an operator and withdraw the role; search and filter.
