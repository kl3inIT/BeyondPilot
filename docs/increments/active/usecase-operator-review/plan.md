# Plan: the operators' review of use cases

Design: [design.md](design.md). Tracked in Linear once an issue is assigned.

## This increment

| Step | What | Done when |
| --- | --- | --- |
| 1 | `UseCaseAdministration.approve` and `sendBack`, the audit actions, `EmailService.sendUseCaseDecision`, `OrganizationDirectory.memberAccountIds` | `UseCaseServiceTest` passes |
| 2 | `openapi.yml` and the generated client refreshed | `OpenApiContractTest` and the drift check pass |
| 3 | Web: the use case page (summary, read-only steps, decision, status history), the list's links and row menu | `pnpm --dir web check` passes; the screens match the Figma frames |

## Next

1. Tablet and mobile frames of the review screens.
2. Operators filter the list by the status that waits for them from the home page.
3. The public directory reads published and closed use cases.
