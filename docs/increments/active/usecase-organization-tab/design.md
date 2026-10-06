# Use cases: the organization's members write and send them

Status: in progress, 7 October 2026. The Linear issue is not assigned yet; rename this directory to `bey-<n>-usecase-organization-tab` when it is. The screens are drawn in Figma: `My organization — Use cases, with statuses`, the five steps `Post a use case — 1 … 5`, `… sent for approval`, and the section `Use cases` rows added on 7 October (`Needs changes, reason shown`, `In review, read-only`, `Edit a published use case (dialog)`, `row menu`). The first slice is [usecase-admin-create](../usecase-admin-create/design.md); the domain is [BEY-22](../bey-22-phase-1-domain-model/design.md).

> **Update, 7 October 2026:** the organization no longer has a role (BEY-61, `V28__organization_drop_roles.sql`). Every approved organization has both solutions and use cases, so wherever this page says an approved enterprise or the enterprise role, it now means any approved organization; the migrations of this increment are numbered V29 to V33.


This slice is the organization's side of a use case. The operators' review (approve, send back with a reason) is the next slice: until it ships nothing leaves `in_review`.

## Domain story

An enterprise that has a problem opens My organization › **Use cases** and chooses **Post a use case**. A draft exists at once; the five steps of the wizard fill it in, and what is typed is saved as it is typed. Anyone of the organization can pick the draft up, so the list says who last edited it.

- On the last step the member checks the use case and sends it. From then on it is **in review** and read-only: GenAI Fund approves it or sends it back. The organization can pull it back to a draft to change it first.
- When GenAI Fund sends it back it is **needs changes**, with a reason the members read in the wizard; they edit it and send it again.
- A **published** use case can be edited too. Its first save takes it out of the directory and makes it a draft again; it returns when it is sent and approved again. A member who would rather not send it yet can move it back to a draft without editing.
- When the deadline passes the use case is **closed** and nobody changes it ([first slice](../usecase-admin-create/design.md#decisions)).

_Failures:_ the caller is not a member of an approved organization that publishes use cases (refused: `403`); the use case belongs to another organization (answered as not found); a save over a newer one (refused, with the current version to reload); an edit of a use case in review or closed (refused); sending one that lacks a part, or whose close date has passed (refused); sending one that is not a draft (refused).

## Statuses and transitions

| From | Command | To | Notes |
| --- | --- | --- | --- |
| – | Post a use case | `draft` | Empty. Named and filled in by saving |
| `draft`, `needs_changes` | Save | same | Any part may be missing |
| `published` | Save | `draft` | Leaves the directory; `published_at` is cleared |
| `draft`, `needs_changes` | Submit | `in_review` | Needs every part and a future close date. Records who and when; clears the reason |
| `in_review`, `published` | Move back to draft | `draft` | Audited with the status it left |
| `in_review`, `closed` | Save | refused | `USECASE_NOT_EDITABLE` |

`closed` stays derived from `closes_at`; it wins over any stored status.

## Data and ownership

The `usecase` module keeps owning `use_case`. [V32](../../../../backend/src/main/resources/db/migration/V32__usecase_allow_partial_drafts.sql) lets the content columns be null, because a draft is written in parts. The check `use_case_complete_when_submitted` keeps a use case that is in review or published complete whatever the application does; `use_case_review_has_sender` keeps a use case in review attributable. It adds `last_edited_by_account_id`, `submitted_at`, `submitted_by_account_id` and `review_note`, and the columns `reviewed_at` and `reviewed_by_account_id` that the operators' review fills.

Membership comes from `OrganizationDirectory.membershipOf`; names from `IdentityService.people`; no new dependency edge. The membership check is "approved, with the enterprise role": every member, owner or not, writes.

## API

All under `/api/usecase/mine`, session required.

| Request | `operationId` | Success | Refusals beyond 401 and 403 |
| --- | --- | --- | --- |
| `GET /` | `listMyUseCases` | `200`, `items` | |
| `POST /` | `createMyUseCase` | `201`, the empty draft | |
| `GET /{id}` | `getMyUseCase` | `200` | `404` |
| `PUT /{id}` | `saveMyUseCase` | `200`, the use case with its new `version` | `400` a part is invalid or out of order; `404`; `409` in review or closed, or a newer version |
| `POST /{id}/submit` | `submitMyUseCase` | `200` | `400` incomplete or past; `404`; `409` not a draft |
| `POST /{id}/draft` | `moveMyUseCaseToDraft` | `200` | `404`; `409` not in review or published |

Failure codes added: `USECASE_ENTERPRISE_REQUIRED` (403), `USECASE_CHANGED_MEANWHILE` (409), `USECASE_NOT_EDITABLE` (409), `USECASE_INCOMPLETE` (400), `USECASE_NOT_SUBMITTABLE` (409), `USECASE_CANNOT_MOVE_TO_DRAFT` (409). Audit actions: `use_case.submit`, `use_case.draft`. A save is not audited: it happens as the member types.

## Decisions

1. **Every member writes, not only owners.** A use case is a request for work, not a public profile; a draft that only the owner can touch would stop the person who knows the problem. This differs from solutions, where the owner writes.
2. **The draft exists before it has content.** Post a use case creates an empty row and opens it, so the autosave has something to save to and a second member can find it in the list. The cost is rows with no title; the list names them "Untitled use case".
3. **Saving is by version.** The save carries the version the member read; the row is locked while it is compared. A second member's save in between is refused with `USECASE_CHANGED_MEANWHILE` and the screen offers to reload. Editing the same field at once is not merged.
4. **Editing a published use case makes it a draft.** The alternative, keeping the published copy visible beside a pending copy, needs two versions of one use case. Until proposals exist nothing depends on the use case being in the directory; the cost of this choice is revisited when they do.
5. **The reason is stored, not yet written.** `review_note` is read by the wizard; the operators' review writes it.

## Boundaries

- No operator review yet: nothing creates `needs_changes` or approves.
- No email on submit; the email on the decision ships with the review.
- The public directory does not read these use cases yet.
- A file replaced in the wizard is not removed from storage.

## Verification

`UseCaseServiceTest` runs over real HTTP against PostgreSQL with two members of one organization: who may, a draft written in parts and saved by two people, the refusals of a save, what sending needs and does, what is locked, a published use case becoming a draft, a closed one, and another organization's use case. `UseCaseAdministrationTest`, `ModulithArchitectureTest` and `OpenApiContractTest` still pass; `pnpm check` passes, including unit tests of the draft's conversion to the request and of what is still missing.
