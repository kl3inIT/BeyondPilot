# Plan: an operator creates a use case

Design: [design.md](design.md). Tracked in Linear once an issue is assigned.

## This increment

| Step | What | Done when |
| --- | --- | --- |
| 1 | Migration `V30__usecase_create_use_cases.sql`, the `usecase` module (entity, repositories, `UseCaseAdministration`, controller, records), `OrganizationDirectory.approvedEnterprise(s)`, audit action `use_case.create` | `UseCaseAdministrationTest` and `ModulithArchitectureTest` pass |
| 2 | `openapi.yml` and the generated web client refreshed | `OpenApiContractTest` and the drift check pass |
| 3 | Admin web: Use cases list, Create a use case, the audit log knows the new action, sidebar link | `pnpm --dir web check` passes; the screens match the Figma frames |

## Later increments

1. The organization's side: the tab Use cases in My organization, draft editing by members, **send for review**, `in_review`.
2. The operators' review: approve (publishes) or send back with a reason (`needs_changes`), the dialogs, the audit events.
3. The public directory and detail page read published and closed use cases; programs feature them.
4. ~~Attachments, through `storage`.~~ Done in this increment: the create form attaches files.
5. Proposals against a use case, which is what the close date gates.
