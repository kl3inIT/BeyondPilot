# Plan: the organization's tab for use cases

Design: [design.md](design.md). Tracked in Linear once an issue is assigned.

## This increment

| Step | What | Done when |
| --- | --- | --- |
| 1 | Migration `V13__usecase_allow_partial_drafts.sql`; the entity holds partial drafts; `UseCaseService` and `MyUseCasesController` | `UseCaseServiceTest` passes; the admin tests still pass |
| 2 | Audit actions `use_case.submit`, `use_case.draft`; the audit log knows them in both languages | `ModulithArchitectureTest`, the audit log screen |
| 3 | `openapi.yml` and the generated web client refreshed | `OpenApiContractTest` and the drift check pass |
| 4 | Web: the tab (counts, list, row menu, dialogs), the wizard with autosave, the read-only page, the sent page | `pnpm --dir web check` passes; the screens match the Figma frames |

## Next

1. **The operators' review:** approve (publishes) or send back with a reason (`needs_changes`), the review page and the send-back dialog drawn in Figma on 7 October, the email to the members, audit events `use_case.approve` and `use_case.send_back`.
2. Tablet and mobile frames of the new screens, once the desktop ones are accepted.
3. The public directory reads published and closed use cases.
4. Proposals against a use case, which is what the close date gates.
