# An organization needs no review: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every organization is active when it is created; operators no longer review organizations, they only take down, restore, merge and decide ownership claims; the owners of the organizations waiting today are emailed once that theirs is active.

**Architecture:** The stored status keeps the value `approved`, so every gate in other modules (`OrganizationDirectory.isApproved`, `approvedAt`, `approvedNames`, `approvedOrganizations`, `Membership.approved`) keeps its predicate and now means "not taken down and not merged". The review paths go from `organization`, `mcp` and the web. V109 moves the waiting rows and marks them, and `ActivationNotices` sends the emails after commit through the notification module's queue. No new module edge.

**Tech Stack:** Java 25, Spring Boot, Spring Modulith, Flyway, PostgreSQL, JUnit with Testcontainers; Next.js, next-intl, TanStack, Playwright on Edge.

**Spec:** [design.md](design.md), with [plan.md](plan.md) for the step states.

## Global Constraints

- Branch `nhuxuanviet27102004/bey-236-drop-organization-review`; commit subjects `type(scope): summary (BEY-236)`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Migration `V109__organization_drop_review.sql`; V108 was the last on `origin/main` on 21 October 2026. Renumber if `MigrationVersionsTest` reports a clash.
- The stored status allows only `approved` and `merged`; taking down stays `suspended_at`.
- Keep `AuditAction.ORGANIZATION_APPROVE`, `ORGANIZATION_REFUSE`, `ORGANIZATION_SEND_BACK` and `EmailKind.ORGANIZATION_APPROVED`, `ORGANIZATION_REFUSED`, `ORGANIZATION_SENT_BACK`; nothing records or sends them any more.
- Keep the published codes `ORGANIZATION_NOT_APPROVED`, `SOLUTION_ORGANIZATION_NOT_APPROVED`, `MESSAGING_ORGANIZATION_NOT_APPROVED`; only their messages change, to say the organization is taken down.
- `GET /api/organization/admin/organizations/queue` keeps its path, `operationId` (`getOrganizationReviewQueue`) and `OrganizationReviewQueueResponse` shape; it counts open claims only.
- New email kind `organization_activated`, group `ORGANIZATIONS`, variables `organizationName` (required, sample "Plain Cover") and `organizationUrl` (optional, sample `https://beyondpilot.example/workspace/organization`).
- Every API change regenerates `openapi.yml` and the web client in the same change. Words in both `web/messages/en.json` and `vi.json`.
- Gates: `./gradlew :backend:check` and `pnpm --dir web check`; run the narrowest test class while working. Check about 3 GB of free RAM before a Gradle run.

## Review Focus

- **Two instances start at once after the deploy.** Each owner gets one email, not two. Owned by Task 4: `theActivationNoticesOfTwoRunsAtOnceSendEachEmailOnce`.
- **An organization taken down after V109 marked it but before the start.** It is still told it is active, which is wrong. Owned by Task 4: `aMarkedOrganizationTakenDownIsClearedWithoutAnEmail`.
- **An operator's saved filter or bookmark `?status=in_review`.** The list answers 400 for an unknown status today; the web parser must drop an unknown value and show every organization, not an error. Owned by Task 8: `admin-organizations-search.test.ts` "drops a status that no longer exists".
- **A builder on their own whose application already went out becomes a team.** It must stay approved and keep its proposals; before, it went back to review. Owned by Task 2: `aPersonOnTheirOwnWhoBecomesATeamStaysApproved`.
- **The last owner of a refused organization**, now taken down, leaves. Today `!isRejected()` let them; it must read taken down. Owned by Task 2: `theLastOwnerLeavesAnOrganizationThatIsTakenDown`.

---

## Backend

### Task 1: V109 and the status the entity allows

**Files:**
- Create: `backend/src/main/resources/db/migration/V109__organization_drop_review.sql`
- Modify: `backend/src/main/java/ai/genaifund/beyondpilot/organization/persistence/Organization.java`
- Test: `backend/src/test/java/ai/genaifund/beyondpilot/organization/OrganizationTest.java`

**Interfaces:**
- Produces: column `organization.activation_notice_pending boolean not null default false`; `Organization.APPROVED` and `Organization.MERGED` as the only statuses; `Organization.IN_REVIEW`, `NEEDS_CHANGES`, `REJECTED`, `approve`, `refuse`, `sendBack`, `resubmit`, `isInReview`, `isSentBack`, `isRejected` removed in Task 2 once their callers go.

- [ ] **Step 1: Write the failing test** `theStatusAllowsOnlyApprovedAndMerged`: inserting an organization row with status `in_review` through `JdbcClient` throws `DataIntegrityViolationException`; one with `approved` saves.
- [ ] **Step 2: Run** `./gradlew :backend:test --tests "*OrganizationTest.theStatusAllowsOnlyApprovedAndMerged"`. Expected: FAIL, the insert succeeds.
- [ ] **Step 3: Write V109** in this order, with a comment naming BEY-236 and Kai's words of 21 October 2026:
  1. add `activation_notice_pending`;
  2. `in_review`, `needs_changes` → `approved`, `activation_notice_pending = true`, decision columns untouched;
  3. `rejected` → `approved`, `suspended_at = coalesce(decided_at, updated_at)`, `suspension_message = decision_message`, `suspension_reason = case decision_reason when 'not_a_real_organization' then 'not_a_real_organization' else 'other' end`, `decision_reason` left as it was;
  4. drop and re-add `organization_status_check` as `status in ('approved', 'merged')`, default `'approved'`;
  5. `delete from email_template where kind in ('organization_approved', 'organization_refused', 'organization_sent_back')`.
- [ ] **Step 4: Run the test and `MigrationVersionsTest`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(organization): every organization is active and V109 activates the waiting ones (BEY-236)`.

### Task 2: No review in `organization`

**Files:**
- Modify: `organization/OrganizationService.java` (`createOwned`, `save` paths at the two `settleTypeChange` calls, `becomeTeam`, `invite`, `removeMember`), `organization/OrganizationAdministration.java` (remove `approve` ×2, `refuse`, `sendBack` ×2, `awaitingReview(UUID)`, `awaitingReview(Actor, int)`, `tellOwners`; `suggestedDomain`; `asker`, `summary`; `queue`), `organization/persistence/Organization.java`, `organization/persistence/OrganizationQueryRepository.java` (`adminPage`, `adminCount`, order, `organizationsWaitingByDay`, `organizationsOldestWaiting`), `organization/web/AdminOrganizationsController.java` (remove `/approve`, `/refuse`, `/send-back`), `organization/OrganizationErrorCode.java` (remove `NOT_AWAITING_REVIEW`; reword `NOT_APPROVED`), `organization/OrganizationDirectory.java` and `Membership.java`, `OrganizationProfile.java` (Javadoc only)
- Delete: `organization/OrganizationsAwaitingReview.java`, `organization/dto/ApproveOrganizationRequest.java`, `RefuseOrganizationRequest.java`, `SendBackOrganizationRequest.java`
- Modify: `organization/dto/AdminOrganizationListRequest.java`, `AdminOrganizationResponse` / `OrganizationResponse` status `allowableValues` → `approved`, `merged`; list filter `allowableValues` → `approved`, `claimed`, `suspended`, `merged`
- Test: `OrganizationTest.java`

**Interfaces:**
- Consumes: Task 1's statuses.
- Produces: `Organization(UUID id, String slug, String name, String type, UUID createdByAccountId)` (the status argument goes; a new one is `approved`); `Organization.settleTypeChange(String formerType)` (only clears the domain of one that becomes individual); `Organization.becomeTeam(String name, String teamSize, @Nullable String website)` without a status change; list status `claimed` = an open claim on it; `OrganizationAdministration.queue(Actor)` unchanged signature, claims only.

- [ ] **Step 1: Rewrite the failing tests** in `OrganizationTest`:
  - `aPersonCreatesACompanyThatIsApprovedAtOnceAndInvites`: status `approved`, `invite` succeeds, no email of kind `organization_approved`.
  - `aPersonOnTheirOwnWhoBecomesATeamStaysApproved` and `aTeamThatBecomesACompanyStaysApproved`.
  - `theLastOwnerLeavesAnOrganizationThatIsTakenDown`; the last owner of an active one is still refused.
  - `theQueueCountsOnlyOpenClaims` (replaces `theQueueCountsWhatWaitedAtTheEndOfEachOfTheLast14Days`): a new organization adds nothing; an open claim adds one today and is `oldestSince`.
  - `theClaimedFilterListsOrganizationsWithAnOpenClaim`; `status=in_review` answers 400.
  - `theReviewEndpointsAreGone`: `POST /organizations/{id}/approve` answers 404 or 405.
  - Delete `anOperatorApprovesAnOrganizationWithItsDomainAndItsOwnerIsTold` and `aRefusedOrganizationIsRefusedForGoodAndOnlyWhileItWaitsForReview`; rename `anOrganizationThatIsNotApprovedIsNeitherFoundNorJoined` to `anOrganizationTakenDownIsNeitherFoundNorJoined` and `onlyAnApprovedOrganizationInvitesAndNoMoreThanItsDailyLimit` to `anOrganizationTakenDownDoesNotInviteAndNoneInvitesPastItsDailyLimit`.
- [ ] **Step 2: Run** `OrganizationTest`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.** `suggestedDomain` offers the creator's work domain while the organization has no domain (no status check). `asker` and `summary` read only the claim (`request` is `"claim"` or null). The default order puts open claims first. `removeMember` checks `isSuspended()` where it checked `isRejected()`.
- [ ] **Step 4: Run** `OrganizationTest`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(organization): operators no longer review an organization (BEY-236)`.

### Task 3: The activation email and the retired review emails

**Files:**
- Create: `backend/src/main/resources/notification/templates/organization_activated.md`
- Modify: `notification/template/EmailKind.java`, `notification/EmailService.java`, `notification/EmailTemplateAdministration.java` (template list)
- Test: `backend/src/test/java/ai/genaifund/beyondpilot/notification/EmailAdministrationTest.java`, `notification/template/EmailRendererTest.java`

**Interfaces:**
- Produces: `EmailKind.ORGANIZATION_ACTIVATED("organization_activated", EmailGroup.ORGANIZATIONS, true, null, Variable.required("organizationName", "Plain Cover"), Variable.optional("organizationUrl", "https://beyondpilot.example/workspace/organization"))`; `EmailService.sendOrganizationActivated(String recipient, String organizationName)`, `@Transactional`, link `url("/workspace/organization")`. Removes `sendOrganizationDecision` and `sendOrganizationSentBack`.

- [ ] **Step 1: Write the failing tests**: `theActivationEmailRendersItsDefault` (subject `Plain Cover is active on BeyondPilot`, body has the link); `theReviewEmailsAreNotInTheTemplateList` (no `organization_approved`, `organization_refused`, `organization_sent_back`; has `organization_activated`); `theEmailLogStillNamesAPastApproval`.
- [ ] **Step 2: Run** both classes. Expected: FAIL.
- [ ] **Step 3: Implement.** The template's copy, as the design fixes it:

```markdown
subject: {{organizationName}} is active on BeyondPilot
---
# {{organizationName}} is active

GenAI Fund no longer reviews organizations, so {{organizationName}} is active on BeyondPilot now. You can invite your team and post use cases. Solutions are still reviewed before they are listed.

[Open your organization]({{organizationUrl}})
```

  The three review kinds stay in the enum with a flag that keeps them out of the template list (`boolean retired`, the kinds' last constructor argument); `EmailKind.of` still resolves them for the log.
- [ ] **Step 4: Run** both classes. Expected: PASS.
- [ ] **Step 5: Commit** `feat(notification): an organization's activation email; the review emails retire (BEY-236)`.

### Task 4: `ActivationNotices`

**Files:**
- Create: `backend/src/main/java/ai/genaifund/beyondpilot/organization/ActivationNotices.java`
- Modify: `organization/persistence/OrganizationQueryRepository.java`
- Test: `OrganizationTest.java`

**Interfaces:**
- Consumes: `EmailService.sendOrganizationActivated(String, String)` (Task 3); `MembershipRepository.members(UUID)`; `IdentityService.people(List<UUID>)`.
- Produces: package-private `@Component class ActivationNotices` with `@EventListener(ApplicationReadyEvent.class) void sendAll()` looping `@Transactional int sendBatch()` until it returns 0; `OrganizationQueryRepository.lockMarked(int limit): List<UUID>` (`select id … where activation_notice_pending order by created_at limit :limit for update skip locked`) and `clearMarks(Collection<UUID> ids): void`. Batch size 100, a named constant. Logs `event=organization.activation.notified` with the count.

- [ ] **Step 1: Write the failing tests**: mark rows with `JdbcClient`, then call `sendBatch()`:
  - `theOwnersOfAMarkedOrganizationAreToldOnceItIsActive`: two owners get one `organization_activated` each; the mark is cleared; a second `sendBatch()` returns 0 and queues nothing.
  - `anOrganizationWithoutAnOwnerIsClearedWithoutAnEmail`.
  - `aMarkedOrganizationTakenDownIsClearedWithoutAnEmail`.
  - `theActivationNoticesOfTwoRunsAtOnceSendEachEmailOnce`: two threads call `sendBatch()` together; each owner has exactly one email.
- [ ] **Step 2: Run.** Expected: FAIL, the class does not exist.
- [ ] **Step 3: Implement** as the Interfaces say. Owners are members with the owner role; an organization taken down or merged is cleared without an email.
- [ ] **Step 4: Run** `OrganizationTest` and `ModulithArchitectureTest`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(organization): the owners of the organizations V109 activates are told once (BEY-236)`.

### Task 5: Words in the other modules

**Files:**
- Modify: `solution/SolutionErrorCode.java`, `solution/SolutionAdministration.java` (comments), `usecase/UseCaseErrorCode.java`, `usecase/UseCaseService.java`, `usecase/UseCaseDirectory.java`, `usecase/UseCaseAdministration.java` and `usecase/dto/CreateUseCaseRequest.java`, `usecase/dto/UseCaseOrganizationListResponse.java` (Javadoc and schema descriptions), `messaging/MessagingErrorCode.java`, `proposal/ProposalService.java` (`requireSwitchable` comment), `search/SolutionIndexing.java`, `search/UseCaseIndexing.java` (Javadoc)
- Test: `solution/SolutionTest.java`

**Interfaces:**
- Consumes: Task 2's statuses. No signature changes.

- [ ] **Step 1: Write the failing test** `aSolutionOfANewOrganizationIsListedOnceApproved` in `SolutionTest`: a person creates a company, submits a solution, an operator approves it, and it is in the directory. Rename the existing "organization not approved" cases to "taken down".
- [ ] **Step 2: Run** `SolutionTest`. Expected: the new test FAILS before Task 2 lands, PASSES after; run it to confirm PASS.
- [ ] **Step 3: Reword** the three `NOT_APPROVED` messages to say the organization is taken down; Javadoc that says "approved organization" says "an organization that is not taken down".
- [ ] **Step 4: Run** `SolutionTest`, `UseCaseServiceTest`, `UseCaseAdministrationTest`, `MessagingTest`, `ProposalTest`. Expected: PASS.
- [ ] **Step 5: Commit** `refactor: an organization is refused only when taken down, in every module's words (BEY-236)`.

### Task 6: MCP without organization review

**Files:**
- Modify: `mcp/server/DecisionTools.java` (organization branch and descriptions), `mcp/server/OperatorTools.java` (`list_pending_reviews` areas without `organizations`; `list_records` organization statuses), `mcp/server/ReviewRecordTools.java`, the server's instructions; `web/src/app/[locale]/(public)/oauth-consent/page.tsx` words and `web/messages/*.json`
- Test: `backend/src/test/java/ai/genaifund/beyondpilot/mcp/McpServerTest.java`

**Interfaces:**
- Consumes: Task 2 removed `OrganizationAdministration.approve(Actor, UUID)`, `sendBack(Actor, UUID, String)`, `awaitingReview(Actor, int)`.

- [ ] **Step 1: Write the failing tests**: `decideRecordRefusesAnOrganization` (a tool error naming the allowed kinds); `listPendingReviewsListsNoOrganizations`. Delete the organization cases of the BEY-232 approve and send-back tests.
- [ ] **Step 2: Run** `McpServerTest`. Expected: FAIL.
- [ ] **Step 3: Implement.** `decide_record`'s `kind` enum drops `organization`.
- [ ] **Step 4: Run** `McpServerTest`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(mcp): operators' tools no longer review organizations (BEY-236)`.

### Task 7: The published contract

**Files:**
- Modify: `openapi.yml`, `web/src/lib/api/generated/*`

- [ ] **Step 1: Regenerate** `openapi.yml` as `docs/guidelines/testing.md` says, then the web client.
- [ ] **Step 2: Run** `OpenApiContractTest` and `./gradlew :backend:check`. Expected: PASS; the diff drops three operations and three schemas and narrows the status enums.
- [ ] **Step 3: Commit** `chore(api): the contract without organization review (BEY-236)`.

## Web

Figma comes first: before Task 8 the frames for Admin home (Ownership claims cell), Admin › Organizations (filter and row menu), an organization's record (no review panel) and My organization (no review banners) are drawn in Figma ([figma guideline](../../../guidelines/figma.md)), and the web follows them.

### Task 8: Admin

**Files:**
- Modify: `web/src/features/admin-home/admin-home-page.tsx` (cell `organizations` → `claims`, `href` `${siteRoutes.adminOrganizations}?status=claimed`, `BuildingIcon` kept), `web/src/features/organization/organization-codes.ts` (`organizationStatuses = ["approved", "claimed", "suspended", "merged"]`), `admin-organizations-page.tsx`, `admin-organizations-search.ts`, `admin-organizations-toolbar.tsx`, `admin-organization-row-actions.tsx`, `admin-organization-page.tsx`, `organization-queries.ts`, `organization-review-queue.tsx`, `web/src/features/email/email-kinds.tsx` (`organization_activated: PartyPopperIcon` or the Figma frame's icon; retired kinds kept for the log), `web/src/features/proposal/received-proposal-page.tsx`, `received-proposals-list.tsx`, `web/messages/en.json`, `vi.json`
- Delete: `web/src/features/organization/organization-review.tsx`
- Create test: `web/src/features/organization/admin-organizations-search.test.ts`. Test: `web/tests/e2e/admin.spec.ts`, `admin-organizations.spec.ts`, `admin-email.spec.ts`, stubs in `web/tests/e2e/stub-*.mjs`

**Interfaces:**
- Consumes: Task 7's generated client: `getOrganizationReviewQueue`, status values `approved | merged`, filter values `approved | claimed | suspended | merged`.

- [ ] **Step 1: Write the failing tests**: `admin-organizations-search.test.ts` "drops a status that no longer exists" (`?status=in_review` parses to no status); `admin.spec.ts` the strip reads `["Ownership claims", 2, "/admin/organizations?status=claimed"]`; `admin-organizations.spec.ts` the row menu has no Approve, Send back or Refuse, and the record has no review panel.
- [ ] **Step 2: Run** `pnpm --dir web test` and `pnpm --dir web e2e admin.spec.ts admin-organizations.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** following the Figma frames; the received-proposal mark shows only for an organization taken down, with its words.
- [ ] **Step 4: Run** the same. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): Admin without organization review, with a cell for ownership claims (BEY-236)`.

### Task 9: Workspace and applying

**Files:**
- Modify: `web/src/features/organization/organization-frame.tsx` (remove the `in_review`, `needs_changes`, `rejected` banners; keep the taken-down one), `organization-profile-editor.tsx` (the missing-facts hint), `organization-members-page.tsx`, `organization-format.ts`, `web/src/features/solution/organization-solutions-page.tsx`, `web/src/features/usecase/my-use-case-queries.ts`, `web/src/features/apply/apply-flow.tsx` (`notListedYet`, `applyingForHint`), `web/src/features/proposal/proposal-you-step.tsx` (`pending`), `web/messages/en.json`, `vi.json`
- Test: `web/src/features/organization/organization-frame.test.tsx`, `web/tests/e2e/workspace-organization.spec.ts`, `apply.spec.ts`, `proposals.spec.ts`

**Interfaces:**
- Consumes: Task 7's client; `isApproved(organization)` in `organization-format.ts` keeps its name and means "not taken down".

- [ ] **Step 1: Write the failing tests**: `organization-frame.test.tsx` "shows no review banner to a new organization" and "shows the taken-down banner"; `workspace-organization.spec.ts` a new company invites at once; `apply.spec.ts` no "Not listed yet" badge.
- [ ] **Step 2: Run** `pnpm --dir web test` and the three specs. Expected: FAIL.
- [ ] **Step 3: Implement** following the Figma frame of My organization; remove the messages no screen uses (knip and the messages check catch leftovers).
- [ ] **Step 4: Run** `pnpm --dir web check` and the specs. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): an organization is active from the start in the workspace and when applying (BEY-236)`.

## Documents

### Task 10: Documents made true

**Files:**
- Modify: `ARCHITECTURE.md` (the `organization` and `mcp` rows; `features/organization/`), `docs/specs/notification.md` (the `organizations` group, the link table, `organization_activated`), `docs/specs/proposal.md` (a team waits for no review), `docs/specs/search.md` (the rebuild after V109), `docs/specs/messaging.md`, `docs/tests/organization.md`, `docs/tests/mcp.md`, `docs/tests/messaging.md`, `docs/tests/notification.md`, `docs/increments/active/bey-236-drop-organization-review/plan.md` (step states)

- [ ] **Step 1: Update each file** so it states what Tasks 1 to 9 built; the matrix rows name the tests of those tasks.
- [ ] **Step 2: Run** `pnpm --dir web check` for the Markdown format, and `grep -rn "in_review" docs/tests/organization.md docs/specs` to confirm no organization review remains.
- [ ] **Step 3: Commit** `docs(organization): the documents say an organization needs no review (BEY-236)`.

After the deploy (plan steps 13 and 14, not tasks of this branch): check the activation emails in Admin › Email on staging, then production; rebuild the search index from Admin; once production has sent them, a later change drops `activation_notice_pending` and `ActivationNotices`.
