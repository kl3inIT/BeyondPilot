# Implementation plan

Design: [design.md](design.md).

## This increment

- [x] Migration `V117__usecase_private_status.sql`: `private` joins the status check.
- [x] `UseCase`, `UseCaseService`, `UseCaseAdministration` and both controllers: the switches, live edits, the completeness guard, audit actions and failure codes.
- [x] `openapi.yml` and the generated web client refreshed.
- [x] Web: the statuses and their words in both languages, the row menus, the wizard's last step, the admin Visibility card and create form, the audit log labels, the public brief without the proposal count.
- [x] Tests: `UseCaseServiceTest` (live edits, the switches, the operator's switches), the updated wizard and admin browser tests.
- [ ] CI green on the pull request, then merged.

## Next

1. Member access: per use case Viewer, Editor and Full access, the Share dialog and the Member access tabs; narrows who may switch.
2. Preview link for a private use case.
3. The listing card for a provider's solution, offer and case studies, once Kai says which card.
