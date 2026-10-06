# Use cases: an operator creates one for an organization

Status: in progress, 6 October 2026. The Linear issue is not assigned yet; rename this directory to `bey-<n>-usecase-admin-create` when it is. The screens are drawn in Figma, section `Admin — Use cases (draft for review)`. The domain behind it is [BEY-22](../bey-22-phase-1-domain-model/design.md) (`usecase`), the brief is [§7.4](../../../brief/BeyondPilot-Vendor-Product-Brief-and-Scope.md#74-enterprise-use-cases).

> **Update, 7 October 2026:** the organization no longer has a role (BEY-61, `V28__organization_drop_roles.sql`). Every approved organization has both solutions and use cases, so wherever this page says an approved enterprise or the enterprise role, it now means any approved organization; the migrations of this increment are numbered V32 to V36.


This is the first slice of the `usecase` module: what an operator does. An organization's own drafting and sending for review, the operators' review, the public directory and attachments follow in later increments ([plan](plan.md)).

## Domain story

GenAI Fund meets an enterprise that has a problem but no time to fill in a form. An operator opens Admin › Use cases, chooses **Create use case**, picks the organization it is for, and writes the brief for it.

- The operator saves it as a **draft**. The organization's members will see it, edit it and send it to GenAI Fund for review (a later increment). Or the operator chooses **Publish now**: GenAI Fund is the reviewer, so there is no review of its own work, and the use case is public at once.
- Whichever the operator chooses, the use case never starts as _in review_.
- The use case has a date when it stops taking proposals. When that moment passes the use case is **closed**: it stays in the directory as a record, and nobody changes it, including GenAI Fund.

_Failures:_ the organization is not approved, or is not an enterprise (refused: only organizations with the enterprise role post use cases); the close date is not in the future (refused); the budget is half given, given and also to be determined, or upside down (refused); the timeline is upside down (refused); someone who is not an operator calls the API (refused, and nothing is revealed).

## Glossary

| Term | Meaning | Not to be confused with |
| --- | --- | --- |
| **Use case** | An enterprise's business problem, published as an opportunity that providers answer with proposals | Program, solution |
| **Requirement** | One thing the solution must do, marked _required_ or _optional_ | Use case tag |
| **Status** | Where a use case stands: `draft`, `in_review`, `needs_changes`, `published`, `closed` | Review status of an organization |
| **Closed** | The status of any use case whose close date has passed. It is derived from the date, never stored | Unpublished |
| **Operator** | A GenAI Fund account with the platform role `operator` | Organization owner |

## Statuses

| Status | Who sees it | How it is reached |
| --- | --- | --- |
| `draft` | The organization's members and operators | An operator or the organization creates it |
| `in_review` | Same | The organization sends a draft to GenAI Fund (later increment) |
| `needs_changes` | Same | An operator sends it back with a reason (later increment) |
| `published` | Everyone | An operator publishes at creation, or approves a use case in review |
| `closed` | Everyone, read only | The close date passes, from any other status |

This increment stores only `draft` and `published`; the other two columns of the constraint exist so that the next increment adds commands, not a migration. `closed` is computed: `closes_at <= now` wins over the stored status.

## Commands, read models and invariants

| Kind | Name | Rule |
| --- | --- | --- |
| Command | Create use case | Operators only. The organization is approved and has the enterprise role. The close date is in the future. The budget range is in order. The result is `draft` or `published`, as the operator chose. Audited |
| Read model | Use case list | Every use case, newest first, narrowed by title and status, paged. Operators only |
| Read model | One use case | As an operator reads it. Operators only |
| Read model | Organizations that can post | Approved enterprises, by name. Operators only; it serves the organization picker of the form |

## Data and invariant owner

The `usecase` module owns `use_case` and `use_case_requirement`. It holds the identifier of the organization, never its entity. It calls `OrganizationDirectory` (new methods `approvedEnterprise` and `approvedEnterprises`) to check and name organizations, `IdentityService.requireOperator` to authorize, and `AuditTrail` to record. The new edge is `usecase → organization, identity, audit`; none points back.

## Data model

`use_case`: `id`, `organization_id`, `title`, `problem_statement`, `industry`, `technologies text[]`, `expected_outcomes`, `current_process`, `current_solutions` (optional), `target_users`, `data_readiness`, `integration_requirements`, `budget_min`, `budget_max` (USD, both null when `budget_to_be_determined`), `budget_to_be_determined`, `budget_members_only`, `timeline_min_weeks`, `timeline_max_weeks`, `hide_organization_name`, `status`, `published_at`, `closes_at`, `created_by_account_id`, `version`, `created_at`, `updated_at`. `use_case_requirement`: `use_case_id`, `position`, `statement`, `necessity`.

Codes (industry, technology, necessity) are stable lowercase values validated in the request record and by check constraints, as in the other modules. Unknown is `null`, never zero.

## API

All under `/api/usecase/admin`, session required, operators only; every refusal is the shared problem.

| Request | `operationId` | Success | Refusals beyond 401 and 403 |
| --- | --- | --- | --- |
| `GET /use-cases?q&status&page` | `listAdminUseCases` | `200`, `items`, `page`, `pageSize` (25), `total` | `400` a bad parameter |
| `POST /use-cases` | `createAdminUseCase` | `201`, the use case | `400` a member is invalid, the budget or the date is out of order; `404` or `409` see below |
| `GET /use-cases/{id}` | `getAdminUseCase` | `200` | `404` |
| `GET /organizations?q` | `listUseCaseOrganizations` | `200`, `items` (id, name), at most 50 | `400` |

Failure codes: `USECASE_NOT_FOUND` (404), `USECASE_ORGANIZATION_NOT_ELIGIBLE` (400: no approved enterprise has this identifier), `USECASE_CLOSES_IN_THE_PAST` (400), `USECASE_BUDGET_INCOMPLETE` (400), `USECASE_BUDGET_OUT_OF_ORDER` (400), `USECASE_TIMELINE_OUT_OF_ORDER` (400).

## Decisions

1. **Creating as an operator needs no review.** GenAI Fund is the reviewer; a second review of its own work would only slow it down. The audit event `use_case.create` records the operator, the organization and the status chosen.
2. **`closed` is derived, not stored.** A stored `closed` would need a job that flips it at the moment of the date and would be wrong in between. The date is the single source; every read and every future command compares it with the clock.
3. **A closed use case is locked for everyone.** There is no operator override. Later commands (edit, send, approve, unpublish) refuse a closed use case with one code.
4. **The organization filter is not in the list yet.** Names live in `organization`; filtering by one would need a cross-module query. The list narrows by title and status.
5. **Attachments use `storage`.** The files carry their own purpose, `use_case_attachment` (PDF, Word, Excel, PowerPoint, PNG, JPEG; 25 MB each; private), and the use case names up to ten of them by identifier in `use_case_attachment`. A file must be stored, uploaded by the caller for this purpose, listed once and attached to no other use case, or the create is refused with `USECASE_ATTACHMENT_NOT_USABLE`. This adds the dependency edge `usecase` → `storage`. Reading a file back waits for the screen that shows one.

## Boundaries

- No organization-side behavior ships here: the organization's members cannot see, edit or send a use case yet.
- No public directory reads these rows yet; the public list keeps its sample content until `usecase read` ships.
- No operator review yet: nothing creates `in_review`.

## Verification

`UseCaseAdministrationTest` runs over real HTTP against PostgreSQL: who may call, what a draft and a published use case hold, each refusal, the audit event, and that a use case past its date reads as closed. `ModulithArchitectureTest` lists the module and `OpenApiContractTest` guards `openapi.yml`; the web client is regenerated and `pnpm check` passes.
