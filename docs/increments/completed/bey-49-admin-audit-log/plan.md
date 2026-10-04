# BEY-49 — plan

Design: [design.md](design.md). Tracked in Linear as BEY-49; one branch, one pull request, a commit per step. Each step waits for the owner's word before it starts.

| #   | Step                                                                                                                                                                                                                                                                      | State                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 0   | Research ([note](../../../research/2026-10-05-admin-audit-log.md)), this design and the Linear issue                                                                                                                                                                      | Done, 5 October 2026          |
| 1   | Figma: section `Admin — Audit log (draft for review)` in the admin frame at 1440, 1024 and 390, with the filtered, full-time tooltip, paged, empty and no-results states; the Audit log item in `AdminSidebar`. Then the owner's approval                                 | Done, approved 5 October 2026 |
| 2   | Backend: the operator check published by `identity` and applied to `/api/audit/**`; `AuditLog`, `AuditEventQueryRepository`, the records in `audit.dto`, `AuditEventsController`; their tests; `docs/tests/audit.md`; `openapi.yml` and the generated web client; the ADR | Done, 5 October 2026          |
| 3   | Web: `/admin/audit-log` at the three widths, the toolbar, `DataTablePager` with Previous and Next, the sidebar destination, both catalogs, the stub backend and the Playwright spec                                                                                       | Done, 5 October 2026          |
| 4   | `docs/tests/audit.md`, the list convention, `ARCHITECTURE.md`, the roadmap, and the increment moved to `completed`                                                                                                                                                        | Done, 5 October 2026          |

## Verification

- `./gradlew :backend:check`
- `pnpm --dir web check` and `pnpm --dir web test:e2e`
- By hand against the local stack: as an operator, disable and enable a second account, then find both events in the log, filter by action, search by the account's name; as a signed-in user who is not an operator, open `/admin/audit-log` and get the not-found page.
