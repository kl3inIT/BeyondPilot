# Proposals: applying to programs and reviewing applications

A signed-in person applies to a program that takes applications on BeyondPilot, and GenAI Fund and the judges it
invites score those applications; GenAI Fund decides and releases the outcomes to every applicant at once. Applying
was delivered by [BEY-37](../increments/completed/bey-37-proposal/design.md), reviewing by
[BEY-38](../increments/completed/bey-38-review/design.md), which followed the
[research on judging](../research/2026-10-06-review-and-judging.md). The code is the `proposal` application module,
`backend/src/main/java/ai/genaifund/beyondpilot/proposal`. Its checks are listed in the
[verification matrix](../tests/proposal.md).

## Module

- **Published API.** The package root: the application services `ProposalService` (applying), `ReviewSetup`
  (criteria and judges), `ReviewService` (reading and scoring) and `OutcomeService` (decisions and release); the
  events `ProposalSubmitted` and `OutcomesReleased`; `ProposalErrorCode` and `ProposalException`. `ReviewAccess`,
  `ReviewerInvited`, `SubmissionMail` and `ReviewMail` are package-private.
- **HTTP.** `proposal.web` holds `ApplicationsController` (`/api/proposal`), `ReviewSetupController` and
  `ReviewController` (both `/api/proposal/review`). Request and response records are in `proposal.dto`.
- **Persistence.** `proposal.persistence` holds the JPA entities and Spring Data repositories: `Proposal`,
  `ProposalVersion`, `ReviewCriterion`, `ProposalReviewer`, `ProposalAssessment`, `ProposalReviewDecision` and
  `ProposalRelease`. Row locks (`ProposalRepository.findForUpdate`) and the decision update
  (`ProposalRepository.decide`) are declared there.
- **Dependencies.** A closed Spring Modulith module allowed `identity`, `program`, `organization`, `solution`,
  `storage`, `notification` and `audit` (`package-info.java`); nothing depends on it. It reads a program's form through
  `ProgramService`, the caller's organization through `OrganizationDirectory`, makes an applicant's organization
  through `OrganizationService.createForApplicant`, reads solutions through `SolutionDirectory`, checks and serves files
  through `StorageService`, queues email through `EmailService` and records operator acts through `AuditTrail`. The
  module's place in the system is in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Tables

| Table (migration)                | Holds                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `proposal` (V13, V17)            | The working copy: `program_id`, `account_id`, `organization_id`, `solution_id`, `status` (`draft`, `submitted`, `withdrawn`), `contact jsonb`, `team_background`, `deck_file_id`, `built_with text[]`, `traction`, `answers jsonb` (by question identifier), `submissions`, `submitted_at`, `withdrawn_at`, `version`, and from V17 `review_status` (`under_review`, `shortlisted`, `not_selected`, default `under_review`). Unique on `(program_id, account_id)` |
| `proposal_version` (V13)         | One row per submission: `(proposal_id, number)`, `submitted_at`, `snapshot jsonb`                                                                                                                                                                                                                                                                                                                                                                                 |
| `review_criterion` (V17)         | A program's criteria in order: `program_id`, `position` (unique per program), `name`, `description`                                                                                                                                                                                                                                                                                                                                                               |
| `proposal_reviewer` (V17)        | A judge invited by address: `program_id`, `email`, `account_id` (set on joining), `invited_by_account_id`, `invited_at`, `expires_at`, `joined_at`, `removed_at`. An address is unique per program, case-insensitively, among rows not removed                                                                                                                                                                                                                    |
| `proposal_assessment` (V17)      | One per application and person, keyed `(proposal_id, account_id)`: `version_number`, `scores jsonb` (by criterion identifier), `note`, `conflict`, `saved_at`                                                                                                                                                                                                                                                                                                     |
| `proposal_review_decision` (V17) | Every change of a decision: `proposal_id`, `account_id`, `from_status`, `to_status`, `reason`, `decided_at`                                                                                                                                                                                                                                                                                                                                                       |
| `proposal_release` (V17)         | One row per released program, keyed `program_id`: `released_at`, `released_by_account_id`, and the subject and message sent to each group                                                                                                                                                                                                                                                                                                                         |

## Applying

### The program's form

- **Which programs.** `ProgramService.applicationForm` answers only a published program with both
  `applications_open_at` and `applications_close_at` set. Any other address is refused with `PROPOSAL_NOT_OPEN`.
- **Window.** A save, a new organization, a submission and a withdrawal need `opensAt <= now < closesAt`. Before the
  window they are refused with `PROPOSAL_NOT_OPEN`, at or after the close with `PROPOSAL_CLOSED`. Reading the form
  works outside the window and reports `program.open`.
- **What the form returns.** `ApplicationViewResponse`: the program (window, `outcomesDueOn`,
  `allowUpdatesUntilClose`, questions), the caller's application or null, the caller's email, their organization (with
  `approved`) and its solutions, each marked `complete`.
- **Starting from the last one.** When the caller has no application to this program yet, `previous` carries the
  contact details, deck, built-with and traction of their most recently changed application.

### The working copy

- **One per person and program.** The first save makes it; reading the form makes nothing.
- **A save keeps whatever the form holds.** Nothing is required until submission. Contact details (first and last
  name, phone, country, LinkedIn), team background, solution, deck, built-with, traction and answers are replaced as
  sent. The application's organization is set to the caller's current organization.
- **Version.** A save of an existing application must send the `version` the form read; a missing or different value
  is refused with `PROPOSAL_CHANGED_MEANWHILE`. The row is locked for the save (`PESSIMISTIC_WRITE`).
- **Answers fit their question.** Only answers to the program's questions are kept, blank ones dropped:
  `single_choice` must be one of the options, `confirm` must be `true`, `link` an `https://` address of at most 500
  characters, text at most the question's `maxLength` (otherwise 300 for `short_text`, 2000 for other text), `file`
  the identifier of a file. Anything else is `PROPOSAL_ANSWER_INVALID`.
- **Files.** A new deck or file answer must be a stored file of purpose `application_file` uploaded by the caller
  (`StorageService.stored`); otherwise storage refuses it (`STORAGE_FILE_NOT_FOUND`). A file the application already
  names stays without the check. `application_file` accepts PDF only and is never public.
- **Solution.** A `solutionId` must be a solution of the caller's organization (`PROPOSAL_SOLUTION_NOT_FOUND`).
- **A withdrawn application that is saved** becomes a draft again.

### Who applies

The four steps of the web form are who applies, the solution, the program's questions (left out when the program has
none) and a review before submitting (`web/src/features/apply/apply-flow.tsx`).

- **A person in an organization** applies for it, whether or not GenAI Fund has approved it.
- **Alone or as a team.** `POST …/application/organization` makes an organization for a person in none, through
  `OrganizationService.createForApplicant`: `kind = individual` makes an `independent_builder` with team size
  `just_me`; `kind = team` makes a `builder_team` with the given team size (`2_9`, `10_49`, `50_99`; `2_9` when
  absent). It waits for GenAI Fund's review like any new organization and is attached to the caller's application if
  one exists. A caller already in an organization is refused with `PROPOSAL_ALREADY_IN_ORGANIZATION`.
- **As a company.** The person joins or creates the company through the `organization` module; the proposal module
  only reads the membership.

### Submitting

`POST /applications/{id}/submit` checks, in order, and refuses with the first code that applies:

| Check                                                                              | Code                                |
| ---------------------------------------------------------------------------------- | ----------------------------------- |
| The caller belongs to an organization                                              | `PROPOSAL_ORGANIZATION_REQUIRED`    |
| First and last name, phone and country are filled; a LinkedIn profile is optional  | `PROPOSAL_CONTACT_INCOMPLETE`       |
| A team background, unless the organization is an `independent_builder`             | `PROPOSAL_TEAM_BACKGROUND_REQUIRED` |
| A solution is chosen                                                               | `PROPOSAL_SOLUTION_REQUIRED`        |
| It is the organization's                                                           | `PROPOSAL_SOLUTION_NOT_FOUND`       |
| It has a summary, the problems it solves and a maturity                            | `PROPOSAL_SOLUTION_INCOMPLETE`      |
| A deck is attached                                                                 | `PROPOSAL_DECK_REQUIRED`            |
| Every required question is answered                                                | `PROPOSAL_ANSWER_REQUIRED`          |
| No other person's application of the same organization to the program is submitted | `PROPOSAL_ORGANIZATION_APPLIED`     |

- **A version with a snapshot.** Each submission increments `submissions` and writes `proposal_version` with that
  number. The snapshot holds the applicant (email, contact), the organization (id, name, type, country, team size,
  website, team background), the solution (id, name, summary, problems solved, maturity), the materials (deck,
  built-with, traction) and each answer with its question's label and kind, and the file for a file answer. A later
  change to a profile leaves the snapshot as it was.
- **The account keeps the country and the phone number.** A submission passes them to
  `IdentityService.reachAtIfUnknown`, which fills the ones the account does not hold yet, so the next form starts
  from them.
- **Event and email.** It publishes `ProposalSubmitted`; `SubmissionMail` queues the applicant's copy in the same
  transaction, so none leaves for a submission that rolled back. The copy names the close when the program allows
  updates until then.
- **Editing until the close.** When the program sets `allowUpdatesUntilClose`, a submitted application can be saved
  and submitted again, each time as a new version. Otherwise a save or a new submission of a submitted application is
  refused with `PROPOSAL_LOCKED`.

### Withdrawing

- **Only a submitted application**, before the close (`PROPOSAL_NOT_SUBMITTED`, `PROPOSAL_CLOSED`). It becomes
  `withdrawn` and can be saved and submitted again while the window is open, when the program sets
  `allowUpdatesUntilClose`. Otherwise the withdrawal is final: a save or a submission of the withdrawn application is
  refused with `PROPOSAL_WITHDRAWN_FOR_GOOD`, since withdrawing and submitting again would be a change by another
  name. My applications carries `allowUpdatesUntilClose` so the applicant is told before and after.
- **A withdrawal returns the decision to under review.** When `review_status` is not `under_review`, a
  `proposal_review_decision` row is appended from that decision to `under_review`, with the applicant's account and
  the reason "The applicant withdrew the application.", and the status is reset. The history keeps the earlier
  decision. Submitting changes without withdrawing keeps the decision.

### My applications

- **`GET /applications`** lists the caller's applications, most recently changed first, with the program, its close
  and `outcomesDueOn`, the status, organization and solution names, `submittedAt`, `updatedAt`, `outcome` and `next`.
- **Programs off the site.** An application whose program is no longer published is left out of the list, and
  `GET /applications/{id}` answers `PROPOSAL_APPLICATION_NOT_FOUND` for it, as it does for another person's
  application.
- **Next step.** `next` is the program's first key date (by start) that starts no earlier than the day after
  `outcomesDueOn` at midnight in Asia/Ho_Chi_Minh, or no earlier than the close when no due day is set; null when
  there is none.
- **Outcome.** `outcome` on the list and on the application is the decision only when the application is submitted and
  the program's outcomes are released; null otherwise.
- **Files.** The applicant sees each attached file's name and size. The module serves no download to the applicant;
  application files are downloaded only through the review.

## Reviewing

### Who may review

- **Programs under review.** `ProgramService.formsUnderReview` answers a program with an application window, whatever
  its status. Any other program identifier is `PROPOSAL_REVIEW_PROGRAM_NOT_FOUND`.
- **Operators** review every program without an invitation. `GET /review/programs` lists, for an operator, every
  program with a submitted application.
- **Judges.** Anyone else reviews a program only through a `proposal_reviewer` row for the address they signed in
  with, matched case-insensitively, not removed, and either joined or not yet expired (`ReviewAccess`). Otherwise
  `PROPOSAL_REVIEW_NOT_ALLOWED`. The first time they open the review or list their programs, the row records their
  account and `joined_at`; from then on it no longer lapses.
- **Never one's own.** A reviewer, operators included, may read but never score or decide an application they
  submitted or one of their organization (`PROPOSAL_OWN_APPLICATION`, 403). Lists and the application carry `own`.
- **Operator-only actions.** Saving criteria, listing, inviting, re-sending and removing judges, deciding and
  releasing need the operator role (`IDENTITY_OPERATOR_REQUIRED`, 403).

### Criteria

- **What they are.** A program's ordered list of at most 12, each with a name (at most 80 characters) and an
  optional description (at most 300). Names are unique per program, ignoring case and surrounding spaces
  (`PROPOSAL_CRITERIA_INVALID`).
- **Replaced whole** by an operator. Any reviewer of the program reads them.
- **Fixed once a score exists.** Once any assessment of an application of the program is saved, a replacement is
  refused with `PROPOSAL_CRITERIA_FIXED`; `CriteriaResponse.fixed` says so.

### Judges

- **Invited by email.** An operator invites an address; it is stored stripped. An address already invited and not
  removed is refused with `PROPOSAL_REVIEWER_INVITED`. The invitation is open for 7 days (`ReviewSetup.INVITATION`).
  `ReviewerInvited` is published and `ReviewMail` queues the email, which carries no link: the person signs in with
  that address and finds the program under Reviews.
- **Sent again.** An invitation not yet used can be re-sent, which renews `invited_at` and `expires_at` for another
  7 days. A judge who joined is refused with `PROPOSAL_REVIEWER_JOINED`.
- **Removed.** Removing sets `removed_at`; the judge loses access, and their scores stay. A removed or unknown judge
  is `PROPOSAL_REVIEWER_NOT_FOUND`. A removed address can be invited again.
- **The list.** `GET …/reviewers` shows each judge not removed with status `active` (joined), `invited` (open) or
  `lapsed` (expired), and each operator who scored, with how many submitted applications each assessed, and the number
  of submitted applications.

### Reading applications

- **Only submitted applications** are reviewed, each as its last version's snapshot; drafts and withdrawals are
  counted, not listed. The list is ordered by `submitted_at`, earliest first, and shows the answer to the program's
  first `single_choice` question.
- **What a judge reads.** Their own assessment and its mean; never anyone else's score, an average across judges, the
  decision or the decision history.
- **What an operator reads.** Every assessment with its author, role (`reviewer` for a joined judge, `operator`
  otherwise), scores, note, conflict and version; the average; the decision; and the history of submissions and
  decisions with reason and who decided.
- **Files.** `GET /review/applications/{id}/files/{fileId}` serves a file only when the last submission's snapshot
  holds it as the deck or a file answer, to anyone who reviews the program; otherwise `PROPOSAL_APPLICATION_NOT_FOUND`.
  The response is the bytes as an attachment, or a 302 to the object store, both `no-store`.

### Assessments

- **One per person and application,** overwritten on each save until the outcomes are released
  (`PROPOSAL_RELEASED`). The program must have criteria (`PROPOSAL_NO_CRITERIA`).
- **Scores.** Every criterion, and only those, from 1 to 5 (`PROPOSAL_ASSESSMENT_INVALID`), with an optional note of
  at most 2000 characters.
- **Conflict.** A reviewer who declares a conflict saves no scores; the assessment counts as assessed but is left out
  of the average and of the `scored` count.
- **Version.** Each save records the submission number it was made on, so a score made before the applicant submitted
  again shows the earlier version.
- **Averages.** An assessment's mean is the mean of its scores; an application's average is the mean of those means,
  conflicts left out. Both are rounded to one decimal.

### Decisions

- **Only operators decide,** `shortlisted` or `not_selected`, for up to 500 submitted applications of the program at
  once, with an optional private reason of at most 1000 characters. An application not among the program's submitted
  ones is `PROPOSAL_APPLICATION_NOT_FOUND`. After the release, `PROPOSAL_RELEASED`.
- **Append-only history.** Each change appends a `proposal_review_decision` row (from, to, reason, who, when) and sets
  `review_status` by its own statement, which leaves the application's `version` and `updated_at` untouched. A decision
  equal to the current one records nothing.
- **Internal.** The applicant sees nothing of the review until the release, and never scores, notes or reasons.

### Release

- **Preview.** `GET …/release` groups the submitted applications into shortlisted, not selected and undecided with
  their averages, counts the withdrawals, and says whether the release is `ready`: not released, closed, every
  application decided and at least one submitted. Before the release it offers starting emails in the program's
  words; after, the emails that were sent.
- **Release.** `POST …/release` is refused with `PROPOSAL_OUTCOMES_NOT_READY` before the close, when nothing was
  submitted, or while a submitted application is `under_review`, and with `PROPOSAL_RELEASED` once released. It stores the two subjects (at most 200
  characters) and messages (at most 5000) once in `proposal_release`.
- **Emails per applicant.** For each submitted application the group's subject and message are filled in, replacing
  `{organization}` and `{solution}` with the names in the last snapshot. `OutcomesReleased` carries them, and
  `ReviewMail` queues one email per applicant in the release's transaction, so they leave once it commits.
- **Final.** After the release, assessments and decisions are refused, and the applicant sees their outcome on My
  applications and on the application.

## Audit

Operator acts, and a file opened by an operator or a judge, are recorded through `AuditTrail` with that person as
actor and the program as resource (type `program`); see [ADR 0003](../decisions/0003-an-audit-module-that-modules-record-through.md).

| Action                     | When                                       | Details                       |
| -------------------------- | ------------------------------------------ | ----------------------------- |
| `proposal.criteria_update` | Criteria replaced                          | `count`                       |
| `proposal.reviewer_invite` | A judge invited, or the invitation re-sent | `email`                       |
| `proposal.reviewer_remove` | A judge removed                            | `email`                       |
| `proposal.decide`          | One per application whose decision changed | `decision`                    |
| `proposal.release`         | Outcomes released                          | `shortlisted`, `not_selected` |
| `proposal.file_open`       | A reviewer opened a file of an application | `application`, `file`         |

Applicants' acts, joining as a judge and assessments are not audited; they are logged as `proposal.submission.accepted`,
`proposal.withdrawal.accepted`, `proposal.reviewer.joined` and `proposal.assessment.saved`, beside
`proposal.decision.recorded` and `proposal.outcomes.released`.

## Events

| Event               | Published                   | Carries                                                                               | Handled by       |
| ------------------- | --------------------------- | ------------------------------------------------------------------------------------- | ---------------- |
| `ProposalSubmitted` | Each submission             | application, program, organization, version, recipient, program name, `editableUntil` | `SubmissionMail` |
| `ReviewerInvited`   | Each invitation and re-send | invitation, email, program name, inviter name, expiry (package-private)               | `ReviewMail`     |
| `OutcomesReleased`  | The release                 | program, and per applicant the decision, recipient, subject and message               | `ReviewMail`     |

The handlers are `@EventListener`s that queue email in the publisher's transaction through `EmailService`
([ADR 0005](../decisions/0005-operators-run-email-delivery.md)).

## HTTP

Every endpoint needs a session.

| Method and path                                                                | Contract                                                          |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `GET /api/proposal/programs/{slug}/application`                                | The form, the caller's application and organization               |
| `PUT /api/proposal/programs/{slug}/application`                                | Save the working copy (`SaveApplication`)                         |
| `POST /api/proposal/programs/{slug}/application/organization`                  | Make the organization of an individual or a team                  |
| `GET /api/proposal/applications`                                               | My applications                                                   |
| `GET /api/proposal/applications/{id}`                                          | One of the caller's applications with its form                    |
| `POST /api/proposal/applications/{id}/submit`                                  | Submit, or submit again                                           |
| `POST /api/proposal/applications/{id}/withdraw`                                | Withdraw                                                          |
| `GET /api/proposal/review/programs`                                            | The programs the caller reviews, with counts and whether released |
| `GET`, `PUT /api/proposal/review/programs/{programId}/criteria`                | Read the criteria; an operator replaces them                      |
| `GET`, `POST /api/proposal/review/programs/{programId}/reviewers`              | An operator lists judges or invites one                           |
| `POST /api/proposal/review/programs/{programId}/reviewers/{reviewerId}/resend` | Re-send an unused invitation                                      |
| `DELETE /api/proposal/review/programs/{programId}/reviewers/{reviewerId}`      | Remove a judge                                                    |
| `GET /api/proposal/review/programs/{programId}/applications`                   | The submitted applications as the caller reviews them             |
| `GET /api/proposal/review/applications/{id}`                                   | One application as submitted last, with assessments and history   |
| `PUT /api/proposal/review/applications/{id}/assessment`                        | Save the caller's assessment                                      |
| `GET /api/proposal/review/applications/{id}/files/{fileId}`                    | A file of the last submission                                     |
| `POST /api/proposal/review/programs/{programId}/decisions`                     | Decide one application or several                                 |
| `GET`, `POST /api/proposal/review/programs/{programId}/release`                | Preview the release; release                                      |

## Error codes

`ProposalErrorCode`; the category sets the status (validation 400, not permitted 403, not found 404, conflict 409).

| Status | Codes                                                                                                                                                                                                                                                                                                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400    | `PROPOSAL_ORGANIZATION_REQUIRED`, `PROPOSAL_CONTACT_INCOMPLETE`, `PROPOSAL_TEAM_BACKGROUND_REQUIRED`, `PROPOSAL_SOLUTION_NOT_FOUND`, `PROPOSAL_SOLUTION_REQUIRED`, `PROPOSAL_SOLUTION_INCOMPLETE`, `PROPOSAL_DECK_REQUIRED`, `PROPOSAL_ANSWER_INVALID`, `PROPOSAL_ANSWER_REQUIRED`, `PROPOSAL_CRITERIA_INVALID`, `PROPOSAL_ASSESSMENT_INVALID`                                        |
| 403    | `PROPOSAL_OWN_APPLICATION`, `PROPOSAL_REVIEW_NOT_ALLOWED`                                                                                                                                                                                                                                                                                                                             |
| 404    | `PROPOSAL_APPLICATION_NOT_FOUND`, `PROPOSAL_REVIEW_PROGRAM_NOT_FOUND`, `PROPOSAL_REVIEWER_NOT_FOUND`                                                                                                                                                                                                                                                                                  |
| 409    | `PROPOSAL_NOT_OPEN`, `PROPOSAL_CLOSED`, `PROPOSAL_LOCKED`, `PROPOSAL_WITHDRAWN_FOR_GOOD`, `PROPOSAL_CHANGED_MEANWHILE`, `PROPOSAL_ALREADY_IN_ORGANIZATION`, `PROPOSAL_ORGANIZATION_APPLIED`, `PROPOSAL_NOT_SUBMITTED`, `PROPOSAL_CRITERIA_FIXED`, `PROPOSAL_NO_CRITERIA`, `PROPOSAL_REVIEWER_INVITED`, `PROPOSAL_REVIEWER_JOINED`, `PROPOSAL_RELEASED`, `PROPOSAL_OUTCOMES_NOT_READY` |
