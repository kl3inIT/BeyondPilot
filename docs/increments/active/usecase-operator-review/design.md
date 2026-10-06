# Use cases: GenAI Fund reviews what an organization sends

Status: in progress, 7 October 2026. The Linear issue is not assigned yet; rename this directory to `bey-<n>-usecase-operator-review` when it is. The screens are drawn in Figma, section `Admin — Use cases (draft for review)`: `Review a use case, in review`, `step 1 The challenge, read-only`, `Send back (dialog)`, `Use cases, row menu`. It follows [usecase-organization-tab](../usecase-organization-tab/design.md), which sends use cases into review.

> **Update, 7 October 2026:** the organization no longer has a role (BEY-61, `V12__organization_drop_roles.sql`). Every approved organization has both solutions and use cases, so wherever this page says an approved enterprise or the enterprise role, it now means any approved organization; the migrations of this increment are numbered V13 to V16.


## Domain story

An operator opens Admin › Use cases and sees what waits for them. They open a use case in review and read it the way its members wrote it: a summary of the four sections, and from each section the step itself, read only, with Back and Continue. Operators decide; they do not edit it.

- **Approve and publish:** the use case is public at once, and every member of its organization is told by email.
- **Send back:** the operator writes a reason the members can read. The use case needs changes; the members read the reason in the wizard, edit it and send it again, which clears the reason. Every member is told by email.
- Both are refused unless the use case is in review at that moment, so two operators cannot decide twice.

## Statuses

| From | Command | To | Notes |
| --- | --- | --- | --- |
| `in_review` | Approve | `published` | `published_at`, `reviewed_at` and `reviewed_by` set; the reason is cleared |
| `in_review` | Send back | `needs_changes` | The reason is stored with who decided and when |
| anything else | Approve, Send back | refused | `USECASE_NOT_AWAITING_REVIEW` |

## API

Under `/api/usecase/admin`, operators only.

| Request | `operationId` | Success | Refusals beyond 401 and 403 |
| --- | --- | --- | --- |
| `POST /use-cases/{id}/approve` | `approveAdminUseCase` | `200`, the use case | `404`; `409` not in review |
| `POST /use-cases/{id}/send-back` | `sendBackAdminUseCase` | `200`, the use case | `400` the reason is blank or over 1000 characters; `404`; `409` not in review |

`GET /use-cases/{id}` now carries who created it, who sent it and who decided, with the times and the reason, for the status history. Failure code added: `USECASE_NOT_AWAITING_REVIEW` (409). Audit actions: `use_case.approve`, `use_case.send_back`.

## Decisions

1. **Operators read, they do not edit.** The review screen reuses the members' step fields in a read-only mode, so an operator sees the use case as it was written and has nothing to type into. A correction goes back to the members as the reason of a send back.
2. **The email does not block the decision.** The decision is saved and audited in its transaction; an address that cannot be reached is logged by the notification module and skipped.
3. **`usecase` depends on `notification`.** The wording of the email is the notification module's, in both languages, as for organization decisions. `OrganizationDirectory.memberAccountIds` names the people to tell.

## Boundaries

- Operators cannot yet edit a draft they created for an organization.
- No notification on submit: operators find use cases in review through the list's status filter and the count in its footer.

## Verification

`UseCaseServiceTest` covers approving (published, audited, both members emailed, a second decision refused) and sending back (a blank reason refused, the members read the reason and edit, sending again clears it). `pnpm check` passes; the read-only step fields are the members' own, which `pnpm check` type-checks.
