# An organization needs no review

Tracked in Linear as BEY-236. It undoes the organization half of the review lifecycle of BEY-76 (`V44__organization_review_lifecycle.sql`) and widens to every organization what BEY-189 gave a builder on their own (`V96__organization_individuals_approved.sql`).

## The problem

GenAI Fund reviews four kinds of record: organizations, solutions, talent profiles and use cases. An organization a person creates waits `in_review` until an operator approves it, sends it back (`needs_changes`) or refuses it (`rejected`). Until then it cannot invite members, its members cannot post use cases or message, and a solution it lists stays out of the directory even after GenAI Fund approves the solution, because `SolutionAdministration.approve` refuses one whose organization is not approved (`SOLUTION_ORGANIZATION_NOT_APPROVED`). On 21 October 2026 Admin showed 309 organizations waiting.

Kai, 21 October 2026: "Organization doesn't need review, that's why we allow them to sign in and build profile. Only listing their solution / or as a talent requires review."

## What changes

1. **An organization is active as soon as it is created**, whoever creates it and whatever its type, as an `independent_builder` already is. Changing its type, or turning a builder on their own into a team, no longer sends it back to review.
2. **There is no organization review.** Operators no longer approve, send back or refuse an organization. The filter values `in_review`, `needs_changes` and `rejected` go, and the Organizations cell of Admin home becomes a cell for ownership claims.
3. **A solution is listed once GenAI Fund approves it**, as long as its organization is not taken down. Solution, talent and use-case review stay as they are.
4. **What needed an approved organization needs one that is not taken down**: inviting members, joining at once by domain, posting use cases, messaging, a proposal's sender, matching, the public organization page, the organization picker of Admin › Use cases.
5. **Operators keep taking organizations down, restoring them and merging duplicates**, and keep deciding ownership claims on imported organizations.
6. **The 309 organizations waiting today become active** in the migration, and their owners are emailed once that their organization is active.
7. **Every organization not taken down has a public page and is found by people looking for one to join**, whether or not it has anything approved.

## Decisions

Each ruling below was made for this design. GenAI Fund answered its three open questions on 21 October 2026, and the answers are recorded here as decisions.

- **Ruling: the stored status keeps the value `approved`, and every gate keeps its predicate.** Every check in another module already reads "approved and not taken down" through `OrganizationDirectory` (`isApproved`, `approvedAt`, `approvedNames`, `approvedOrganizations`, `Membership.approved`, `OrganizationProfile.approved`) or the same SQL in `OrganizationQueryRepository`. Once every organization is created `approved` and the migration moves the waiting ones there, these gates mean "not taken down and not merged" with no change of logic in `solution`, `usecase`, `messaging`, `matching`, `proposal`, `search` or `mcp`. Renaming to `active` would change the database value, the published API (`status`, `approved`, `organizationApproved`), the generated web client and every caller for no change of behaviour. The Javadoc of these methods and of `Organization.isApproved()` is reworded to say what the word now means.
- **Ruling: the status column allows only `approved` and `merged`.** The migration leaves no other value, and nothing writes one. Taking down stays `suspended_at`, beside the status, as since V44.
- **Ruling: a refused organization becomes a taken-down one.** Without review, `rejected` has no way back: an operator could neither approve nor restore it. As V45 did for talent profiles, the refusal becomes the takedown: status `approved`, `suspended_at` the time of the refusal, `suspension_message` the operator's note, and `suspension_reason` the refusal's reason where both lists have it (`not_a_real_organization`), else `other`, with the original reason (`duplicate`, `out_of_scope`) kept in `decision_reason`. Operators restore it if they wish; it stays out of every directory until then, as it was.
- **Ruling: the decision columns stay, read by nobody new.** `decision_reason`, `decision_message` and `decided_at` keep the past review of each organization for history; no code writes them any more, and the screens stop showing them. The audit log is the record of who decided what.
- **Ruling: the email and audit codes of the review are kept for history.** `AuditAction.ORGANIZATION_APPROVE`, `ORGANIZATION_REFUSE` and `ORGANIZATION_SEND_BACK` stay so the audit log still names past entries; nothing records them any more. `EmailKind.ORGANIZATION_APPROVED`, `ORGANIZATION_REFUSED` and `ORGANIZATION_SENT_BACK` were really sent, and the email log stores the code as text and the web labels it, so the values and their labels stay; their send methods (`sendOrganizationDecision`, `sendOrganizationSentBack`) go, and the three leave the template list of Admin › Email › Appearance. Their rows in `email_template` are deleted by the migration, as V87 did, since no email of these kinds will be rendered again.
- **Ruling: ownership claims keep their operator decision.** A claim asks to answer for an organization GenAI Fund imported (AWS, a partner), which is a different risk from creating one's own. Claims stay on the organization's record and first in Admin › Organizations (the list's `request` stays, with only `claim`).
- **Decision (GenAI Fund): Admin home keeps a cell for ownership claims, where the Organizations cell was.** `GET /api/organization/admin/organizations/queue` already answers the shared queue shape (`OrganizationReviewQueueResponse`: `waiting`, `oldestSince`, `from`, `days`), and `organizationsWaitingByDay` and `organizationsOldestWaiting` already count open claims beside organizations `in_review`. Ruling: the endpoint, its path, its operation and its shape stay; both queries drop the organization half and count open claims only; the descriptions say claims. The cell is labelled "Ownership claims" and opens Admin › Organizations filtered to open claims with a new filter value, `claimed`, which replaces the way `in_review` also selected an organization with an open claim.
- **Decision (GenAI Fund): an organization with nothing approved has a public page and is found by people looking for one to join.** It follows from the gates as they are: `approvedAt` and `search` read approved and not taken down, so no code changes.
- **Decision (GenAI Fund): the owners of the organizations V109 activates are told by email, once, after commit, never from the migration.** Ruling on how:
  - The migration only marks: it sets a new column, `organization.activation_notice_pending`, on the rows it moves from `in_review` or `needs_changes`. Refused ones, which become taken down, are not marked.
  - `ActivationNotices`, a package-private component of `organization`, listens for `ApplicationReadyEvent`. In one transaction per batch of 100 it locks marked rows (`for update skip locked`), queues one email per owner through `EmailService`, and clears the mark. The email is a row of the notification module's queue written in the same transaction, so a rollback keeps the mark and sends nothing, and a commit clears the mark with the emails queued: each owner is told once, whichever instance starts first. An organization without an owner yet has its mark cleared without an email.
  - A new kind, `organization_activated`, with its own default template: "{{organizationName}} is active on BeyondPilot". It says GenAI Fund no longer reviews organizations, that the organization can invite members and post use cases now, that its solutions are still reviewed before they are listed, and links to My organization. `organization_approved` is not reused: its copy says "GenAI Fund approved", which is no longer what happened, and its past log entries should keep meaning approval.
  - The column and `ActivationNotices` are removed by a later migration and change once production has run them (plan step 14). Until then the listener finds no marked row and does nothing.
- **Ruling: a domain is verified only by an operator.** Approval was where an operator confirmed the email domain that lets an address join at once. The domain stays an operator's: saved on the organization's record (already allowed whatever the status) or by a claim decision. The record keeps suggesting a domain from the website; the suggestion from the creator's work address, which was only made while the organization was in review, is offered while the organization has no domain. Until an operator sets one, people join by invitation or by a request the owners accept.
- **Ruling: `NOT_APPROVED` codes keep their names, with words about being taken down.** `ORGANIZATION_NOT_APPROVED`, `SOLUTION_ORGANIZATION_NOT_APPROVED` and `MESSAGING_ORGANIZATION_NOT_APPROVED` are published codes the web matches. They now arise only for an organization taken down, so their messages say that, in both languages.
- **Ruling: the last owner may leave an organization that is taken down**, in place of one that was refused (`OrganizationService` checks `isRejected()` today), since that is what a refused organization becomes.
- **Ruling: MCP loses the organization branch of review.** `decide_record` no longer takes an organization, `list_pending_reviews` no longer lists organizations, and `list_records` filters organizations by the new statuses. `create_organization` already creates an approved one.
- **No new module edge.** Every consumer already depends on `organization`; the changes are inside existing edges.

## The migration

`V109__organization_drop_review.sql`. V108 was the last migration on `origin/main` on 21 October 2026; the number is checked again when the branch lands, and `MigrationVersionsTest` catches a clash.

1. `organization.activation_notice_pending boolean not null default false` is added. Organizations `in_review` or `needs_changes` become `approved` with the mark set; their decision columns are left as they are.
2. Organizations `rejected` become `approved` and taken down, as ruled above.
3. The status check becomes `status in ('approved', 'merged')`, and the default becomes `approved`.
4. The `email_template` rows of `organization_approved`, `organization_refused` and `organization_sent_back` are deleted.

The migration sends nothing; the emails go out from `ActivationNotices` when the application starts after it.

A migration publishes no `OrganizationChanged`, so the search index does not learn that solutions and use cases of these organizations may now be listed. After the deploy an operator rebuilds the index from Admin (`SolutionIndexing.rebuild`, `UseCaseIndexing`). Solutions already approved whose organization went back to review (a builder on their own who became a team) reappear in the directory then.

## Effect on each module

| Module | What changes |
| --- | --- |
| `organization` | `ActivationNotices` sends the one-time emails; the queue counts open claims only; creation stores `approved` for every type; `settleTypeChange` and `becomeTeam` stop sending an organization back to review; `resubmit`, `approve`, `refuse` and `sendBack` go from the entity, `OrganizationAdministration`, `AdminOrganizationsController` and the MCP-facing overloads; `awaitingReview` and `OrganizationsAwaitingReview` go; the list's status filter is `approved`, `claimed`, `suspended` and `merged`, and its order puts open claims first; `ApproveOrganizationRequest`, `RefuseOrganizationRequest`, `SendBackOrganizationRequest` and `NOT_AWAITING_REVIEW` go; the remove-owner rule reads taken down |
| `solution` | No change of logic: approving, publishing and restoring a solution still refuse one whose organization is taken down. Javadoc and the error's words |
| `search` | No change of code; the index is rebuilt after the deploy |
| `usecase` | No change of logic; the words of `UseCaseErrorCode` and the Javadoc that say "approved organization" |
| `messaging` | No change of logic; the words of `MESSAGING_ORGANIZATION_NOT_APPROVED` |
| `matching`, `proposal` | No change of logic; `requireSwitchable` still locks a builder on their own that is taken down |
| `mcp` | `decide_record` without organizations; `list_pending_reviews` without organizations; the server's instructions and the consent screen in both languages |
| `notification` | `organization_activated` and `sendOrganizationActivated` are added; the two review send methods go; the three review kinds stay for the log and leave the template list |
| `audit` | The three actions stay for the log; nothing records them |

## Effect on each screen

| Screen | What changes |
| --- | --- |
| Admin home | The Organizations cell becomes Ownership claims, opening the list filtered to open claims |
| Admin › Organizations | No review actions in the row menu; the status filter offers Active, Claimed, Taken down, Merged; claims still come first |
| An organization's record (Admin) | `organization-review.tsx` goes: no approve, send back or refuse; the domain is set on the profile form; take down, restore, merge and claims stay |
| My organization (workspace) | The banners for in review, sent back and refused go (`organization-frame.tsx`); the hint asking for missing facts while in review goes (`organization-profile-editor.tsx`); invitations are open at once |
| My organization › Solutions, use cases | The note that the organization is not approved yet now shows only for one taken down |
| Apply flow, proposal wizard | The "not listed yet" and "pending" badges go; a taken-down organization shows its state |
| Received proposals (Admin) | The "organization not approved" mark shows only for one taken down |
| Public organization page and join search | Every organization not taken down shows, as approved ones do today |
| Admin › Email › Appearance | The three review emails leave the list and Organization active joins it; the log still names old messages |

Figma is drawn first for Admin home, Admin › Organizations, an organization's record and My organization.

## What stays the same

- Solution, talent profile, use case and customer deployment review, with their queues and emails.
- Taking an organization down and restoring it, with its emails (`organization_taken_down`, `organization_restored`), and merging duplicates.
- Ownership claims and requests to join.
- A builder on their own has no members, domain or page of its own.
- The organization a use case belongs to is still chosen from organizations not taken down.

## Risks

- **309 organizations become public at once**, with profiles nobody read. Some may be spam or test data. Operators take down what should not show; solutions and use cases are still reviewed before they list.
- **Invitations open to every new organization.** The daily and open limits of BEY-26 (`DAILY_INVITATIONS`) remain the guard against a fake organization inviting many addresses.
- **No organization joins at once by domain until an operator sets the domain.** Today approval was the moment to do it; now an operator has to open the record.
- **About 309 emails are queued at one start.** The notification queue sends them at its own pace, and a failure retries as any email does.
- **The index is stale until rebuilt** after the deploy, as the migration sends no events.
- **The migration number** may clash with another branch and is checked before landing.
