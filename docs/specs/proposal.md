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
  (criteria and judges), `ReviewService` (reading and scoring), `OutcomeService` (decisions and release) and
  `UseCaseProposals` (proposals to use cases); the events `ProposalSubmitted`, `OutcomesReleased` and
  `UseCaseProposalSent`; `SentUseCaseProposal`, what `UseCaseProposals.sentTo` gives `matching` of each proposal a
  use case holds now, with its text, its PDF's bytes and its solutions (BEY-229); the records
  `ProgramApplications`, `SubmittedApplication` and `ApplicationFile` that `mcp` reads through `ReviewService`;
  `ProposalErrorCode` and `ProposalException`. `matching` depends on it for the proposals it judges. `ReviewAccess`, `ReviewerInvited`, `SubmissionMail`, `ReviewMail` and
  `ProposalOrganizationMerge` are package-private.
- **HTTP.** `proposal.web` holds `ApplicationsController` and `UseCaseProposalsController` (both `/api/proposal`),
  `ReviewSetupController` and `ReviewController` (both `/api/proposal/review`). Request and response records are in
  `proposal.dto`.
- **Persistence.** `proposal.persistence` holds the JPA entities and Spring Data repositories: `Proposal`,
  `ProposalVersion`, `ReviewCriterion`, `ProposalReviewer`, `ProposalAssessment`, `ProposalReviewDecision`,
  `ProposalRelease`, `ProposalReleaseDraft`, `UseCaseProposal`, `UseCaseProposalSolution` and
  `UseCaseProposalDecision`. Row locks (`ProposalRepository.findForUpdate`) and the decision update
  (`ProposalRepository.decide`) are declared there.
- **Dependencies.** A closed Spring Modulith module allowed `identity`, `program`, `organization`, `solution`,
  `storage`, `notification`, `audit`, `shared` and `usecase` (`package-info.java`); `mcp` depends on it. It reads a
  program's form through `ProgramService`, the caller's organization through `OrganizationDirectory`, makes an
  applicant's organization through `OrganizationService.createForApplicant`, reads solutions through
  `SolutionDirectory`, reads a use case through `UseCaseDirectory`, checks and serves files through `StorageService`,
  writes downloads through `shared.Spreadsheet`, queues email through `EmailService` and records operator acts through
  `AuditTrail`. The module's place in the system is in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Tables

| Table (migration)                                  | Holds                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `proposal` (V13, V17, V88)                         | The working copy: `program_id`, `account_id`, `organization_id`, `solution_id`, `status` (`draft`, `submitted`, `withdrawn`), `contact jsonb`, `team_background`, `deck_file_id`, `built_with text[]`, `traction`, `answers jsonb` (by question identifier), `submissions`, `submitted_at`, `withdrawn_at`, `version`, and from V17 `review_status` (`under_review`, `shortlisted`, `not_selected`, default `under_review`). Unique on `(program_id, account_id)`          |
| `proposal_version` (V13)                           | One row per submission: `(proposal_id, number)`, `submitted_at`, `snapshot jsonb`                                                                                                                                                                                                                                                                                                                                                                                          |
| `review_criterion` (V17)                           | A program's criteria in order: `program_id`, `position` (unique per program), `name`, `description`                                                                                                                                                                                                                                                                                                                                                                        |
| `proposal_reviewer` (V17)                          | A judge invited by address: `program_id`, `email`, `account_id` (set on joining), `invited_by_account_id`, `invited_at`, `expires_at`, `joined_at`, `removed_at`. An address is unique per program, case-insensitively, among rows not removed                                                                                                                                                                                                                             |
| `proposal_assessment` (V17)                        | One per application and person, keyed `(proposal_id, account_id)`: `version_number`, `scores jsonb` (by criterion identifier), `note`, `conflict`, `saved_at`                                                                                                                                                                                                                                                                                                              |
| `proposal_review_decision` (V17)                   | Every change of a decision: `proposal_id`, `account_id`, `from_status`, `to_status`, `reason`, `decided_at`                                                                                                                                                                                                                                                                                                                                                                |
| `proposal_release` (V17)                           | One row per released program, keyed `program_id`: `released_at`, `released_by_account_id`, and the subject and message sent to each group                                                                                                                                                                                                                                                                                                                                  |
| `proposal_release_draft` (V72)                     | One row per program whose release emails an operator has written, keyed `program_id`: the subject and message of each group as last written, `updated_by_account_id` and `updated_at`. Removed by the release                                                                                                                                                                                                                                                              |
| `use_case_proposal` (V78, V82, V83, V88, V92, V93) | An organization's proposal to a use case, unique on `(use_case_id, organization_id)`: `status` (`draft`, `sent`), `approach`, `deck_file_id`, `team_background`, `created_by_account_id`, `sent_by_account_id`, `sent_at`, `edited_at`, `withdrawn_at` (only on a draft), the decision and outcome columns of V93, `version`. `talent` holds the sender's profile only for a proposal sent before V83; `use_case_proposal_member` (V78) is no longer written or read (V88) |
| `use_case_proposal_solution` (V78)                 | The solutions a proposal offers, in order: `(proposal_id, solution_id)`, `position`                                                                                                                                                                                                                                                                                                                                                                                        |
| `use_case_proposal_decision` (V93)                 | Every decision on a use-case proposal: `decision`, `decided_by_account_id`, `decided_at`                                                                                                                                                                                                                                                                                                                                                                                   |

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
  `single_choice` must be one of the options, `multi_choice` a list of them, `confirm` must be `true`, `link` an
  `https://` address of at most 500 characters, text at most the question's `maxLength` (otherwise 300 for
  `short_text`, 2000 for other text), `file` the identifier of a file. Anything else is `PROPOSAL_ANSWER_INVALID`.
- **Several choices are one text.** `answers` maps a question's identifier to text, in the request, in the row and
  in the answer, whatever the question's kind. The answer to a `multi_choice` question is a JSON array of the options
  chosen, written as text: `"[\"Claims\",\"Pricing\"]"`. It names one or more of the question's options, each exactly
  as the question writes it and once; anything else, an empty list included, is `PROPOSAL_ANSWER_INVALID`. It is kept
  in the order the question offers its options, whatever order it was sent in. A form that has nothing chosen sends
  no answer, which is what a required question refuses at submission. A snapshot keeps the same text as the answer's
  `value`, with `kind` `multi_choice`, and the review reads it from there.
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
  absent). A team waits for GenAI Fund's review like any new organization; an `independent_builder` is approved at once
  ([BEY-189](../increments/completed/bey-189-solo-applicant/design.md)). Either is attached to the caller's application if
  one exists. A caller already in an organization is refused with `PROPOSAL_ALREADY_IN_ORGANIZATION`.
- **Applying as oneself.** The `independent_builder` keeps the name it was given, which its owner may change like any
  organization's ([this increment](../increments/completed/just-me-is-an-organization/design.md)). While nothing of it was sent (no submitted application, no use-case proposal out of draft, no solution out of
  draft), the application form's `organization.changeable` is true: `kind = team` turns it into that team, which waits
  for review, and `POST …/application/organization/leave` takes the person out of it, leaving the application with no
  organization so that they join or add a company. Once something was sent, both answer
  `PROPOSAL_INDIVIDUAL_LOCKED`.
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
  website, team background), the solution (id, name, summary, problems solved, maturity, `demoUrl`), the materials
  (deck, built-with, traction) and each answer with its question's label and kind, and the file for a file answer. A
  later change to a profile leaves the snapshot as it was. A snapshot taken before submissions kept the demo link has
  no `demoUrl` key in its solution, which reads as no link.
- **The account keeps the country and the phone number.** A submission passes them to
  `IdentityService.reachAtIfUnknown`, which fills the ones the account does not hold yet, so the next form starts
  from them.
- **Event and email.** It publishes `ProposalSubmitted`; `SubmissionMail` queues the applicant's copy in the same
  transaction, so none leaves for a submission that rolled back. The copy names the close when the program allows
  updates until then, and links to the application's page, `/applications/<id>` on the site, so the applicant comes
  back to it from the email.
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
  `ReviewerInvited` is published and `ReviewMail` queues the email. Its link opens the program's applications,
  `/reviews/<program id>` on the site, after signing in; it carries no token, so the person still signs in with that
  address, and also finds the program under Reviews.
- **Sent again.** An invitation not yet used can be re-sent, which renews `invited_at` and `expires_at` for another
  7 days. A judge who joined is refused with `PROPOSAL_REVIEWER_JOINED`.
- **Removed.** Removing sets `removed_at`; the judge loses access, and their scores stay. A removed or unknown judge
  is `PROPOSAL_REVIEWER_NOT_FOUND`. A removed address can be invited again.
- **The list.** `GET …/reviewers` shows each judge not removed with status `active` (joined), `invited` (open) or
  `lapsed` (expired), and each operator who scored, with how many submitted applications each assessed, and the number
  of submitted applications.

### Reading applications

- **Only submitted applications** are reviewed, each as its last version's snapshot; drafts and withdrawals are
  counted, not listed among them. An operator, never a judge, follows up the drafts on a page of their own before the close (`GET …/programs/{programId}/drafts`, BEY-193): each applicant's name, sign-in address, phone, country and organization, when the draft was started and last saved, and how far it got (contact complete, solution chosen, deck attached, required questions answered). `POST …/drafts/export` downloads the same as a spreadsheet, recorded as `proposal.drafts_export`. An operator opens one draft as it stands now, in the shape of a submission (`GET …/review/drafts/{id}`, its files at `…/drafts/{id}/files/{fileId}`), to see who may yet apply. Reading a draft or a file, by an operator or a judge, is not audited: it stays inside the reader's own permission (BEY-203). The list is ordered by `submitted_at`, earliest first, and shows the answer to the program's
  first `single_choice` question; a `multi_choice` answer is read on the application, not in the list.
- **What every reviewer reads.** The submission as its snapshot holds it, with the link to the product's demo
  (`submitted.demoUrl`) when the solution had one at submission; the application page shows it under the solution and
  opens it in a new tab. The list and the download do not carry it.
- **What a judge reads.** Their own assessment and its mean; never anyone else's score, an average across judges, the
  decision or the decision history.
- **What an operator reads.** Every assessment with its author, role (`reviewer` for a joined judge, `operator`
  otherwise), scores, note, conflict and version; the average; the decision; and the history of submissions and
  decisions with reason and who decided.
- **Files.** `GET /review/applications/{id}/files/{fileId}` serves a file only when the last submission's snapshot
  holds it as the deck or a file answer, to anyone who reviews the program; otherwise `PROPOSAL_APPLICATION_NOT_FOUND`.
  The response is the bytes as an attachment, or a 302 to the object store, both `no-store`. On the review page
  Open reads the file in the page instead of downloading it (BEY-205): a full-screen viewer (`PdfViewer`, drawn by
  `react-pdf`, loaded on first open) shows every page one under the other, "Page n / N" as the reader scrolls, the
  record's other files one step away with the arrows or ← and →, and the download at hand; a file it cannot draw
  offers the download instead. Viewing in the page is a convenience, not a protection: the file can still be saved.

### Assessments

- **One per person and application,** overwritten on each save until the outcomes are released
  (`PROPOSAL_RELEASED`). The program must have criteria (`PROPOSAL_NO_CRITERIA`).
- **Scores.** Every criterion, and only those, from 1 to 10 (`PROPOSAL_ASSESSMENT_INVALID`), with an optional note of
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
  application decided and at least one submitted. Before the release it offers the emails as an operator last
  wrote them, or starting emails in the program's words when nobody has; after, the emails that were sent.
- **Draft.** `PUT …/release/draft` keeps the two subjects and messages as an operator is writing them, in
  `proposal_release_draft`; a part may be empty, and nothing is sent. The page saves a moment after the last key.
  It is refused with `PROPOSAL_RELEASED` once released, and the release removes the draft.
- **Preview on the page.** Under each group's message the release page shows the email as one applicant of that group
  gets it, with `{organization}` and `{solution}` filled in as the release fills them, one applicant after another,
  and the link and sign-off the email adds (BEY-209). Any other `{…}` in a subject or message is named under it, and
  Release stays disabled until it is fixed: the release would send it as typed.
- **Release.** `POST …/release` is refused with `PROPOSAL_OUTCOMES_NOT_READY` before the close, when nothing was
  submitted, or while a submitted application is `under_review`, and with `PROPOSAL_RELEASED` once released. It stores the two subjects (at most 200
  characters) and messages (at most 5000) once in `proposal_release`.
- **Emails per applicant.** For each submitted application the group's subject and message are filled in, replacing
  `{organization}` and `{solution}` with the names in the last snapshot. `OutcomesReleased` carries them, and
  `ReviewMail` queues one email per applicant in the release's transaction, so they leave once it commits. Each
  email ends with a link to the applicant's application, which the operator does not write.
- **Final.** After the release, assessments and decisions are refused, and the applicant sees their outcome on My
  applications and on the application.

## Audit

Operator acts, and a file opened by an operator or a judge, are recorded through `AuditTrail` with that person as
actor and the program as resource (type `program`); see [ADR 0003](../decisions/0003-an-audit-module-that-modules-record-through.md).

| Action                     | When                                          | Details                       |
| -------------------------- | --------------------------------------------- | ----------------------------- |
| `proposal.criteria_update` | Criteria replaced                             | `count`                       |
| `proposal.reviewer_invite` | A judge invited, or the invitation re-sent    | `email`                       |
| `proposal.reviewer_remove` | A judge removed                               | `email`                       |
| `proposal.decide`          | One per application whose decision changed    | `decision`                    |
| `proposal.release`         | Outcomes released                             | `shortlisted`, `not_selected` |
| `proposal.file_open`       | A reviewer opened a file (until 14 Oct 2026)  | `application`, `file`         |
| `proposal.export`          | An operator downloaded the applications       | `count`                       |
| `proposal.drafts_export`   | An operator downloaded the drafts             | `count`                       |
| `proposal.draft_open`      | An operator opened a draft (14 Oct 2026 only) | `application`                 |
| `use_case_proposal.export` | An operator downloaded a use case's proposals | `count`                       |

### Download

An operator downloads a program's submitted applications as a spreadsheet (`ReviewService.export`, BEY-96), an Excel
workbook or CSV as `?format=xlsx|csv` asks, written by `shared.Spreadsheet`: one row for each, the earliest submitted
first, with the organization, the solution, the applicant's name, email, phone, country and LinkedIn, the answer to
the first one-choice question, the submission time and version, GenAI Fund's decision, whether the outcomes are
released, and how many judges scored it with their mean. The request may name the applications to include, which is
how the web sends the list as it is narrowed. The file is named `<slug>-applications-<day>`. A judge is refused. Each
download is recorded as `proposal.export`, since it takes contact details out. The drafts (`proposal.drafts_export`)
and the proposals a use case received (`use_case_proposal.export`, operators only) are downloaded the same way.

Applicants' acts, joining as a judge and assessments are not audited; they are logged as `proposal.submission.accepted`,
`proposal.withdrawal.accepted`, `proposal.reviewer.joined` and `proposal.assessment.saved`, beside
`proposal.decision.recorded` and `proposal.outcomes.released`.

## Use-case proposals: sending

An organization proposes to a use case another organization posted (BEY-133). The code is `UseCaseProposals`; a member
of any organization other than the one that posted the use case proposes for it, and GenAI Fund's review of that
organization does not hold the proposal up.

- **One working copy per organization and use case,** shared by its members. The first save makes it. A save keeps what
  the form holds, under the `version` it read (`PROPOSAL_CHANGED_MEANWHILE`): the solutions offered, each of the
  organization's own and once, whatever their review says (`PROPOSAL_SOLUTION_NOT_FOUND`), the approach, a PDF uploaded
  by the caller as an `application_file`, and the team background.
- **Who.** Someone in no organization is refused with `PROPOSAL_NO_ORGANIZATION`; a member of the posting organization
  with `PROPOSAL_OWN_USE_CASE`; an unknown use case is `PROPOSAL_USE_CASE_NOT_FOUND`, and one that has closed takes no
  save, send or withdrawal (`PROPOSAL_USE_CASE_CLOSED`). The form of a closed use case still shows the caller the
  proposal their organization sent or took back.
- **Sending** (`POST …/use-case-proposals/{id}/send`) checks again, in order: a solution (`PROPOSAL_SOLUTION_REQUIRED`),
  an approach (`PROPOSAL_APPROACH_REQUIRED`), the PDF (`PROPOSAL_PDF_REQUIRED`), and for a `builder_team` its team
  background (`PROPOSAL_TEAM_BACKGROUND_REQUIRED`); then the sender's account must hold a name, a country and a phone
  number (`PROPOSAL_CONTACT_REQUIRED`). A proposal sent already is `PROPOSAL_ALREADY_SENT`. The sender is emailed
  (`proposal_sent`) once the sending commits, with until when it may still be edited.
- **Editing after sending.** A sent proposal may be saved until `sent_at` plus the use case's `proposal_edit_days`
  while the use case is open, and must stay complete; after that `PROPOSAL_EDIT_WINDOW_CLOSED`. A use case that allows
  no days keeps a sent proposal as sent.
- **Taking it back.** `POST …/use-case-proposals/{id}/withdraw` turns a sent proposal (otherwise `PROPOSAL_NOT_SENT`)
  into a draft with `withdrawn_at`, while the use case is open whatever the time to edit; the posting organization no
  longer reads or counts it, and it may be sent again.
- **What the posting side reads.** Its members and operators read the sent proposals of the use case, one of them,
  and its PDF. `GET /api/proposal/use-case-proposal-counts` answers anyone, without a session, how many proposals each
  use case received.
- **A merge** gives the merged organization's proposals to the one kept, with a new version, except for a use case
  the kept one has a proposal for; the duplicate's draft for such a use case is dropped (`ProposalOrganizationMerge`).

## Use-case proposals: decisions and outcomes

An organization's proposal to a use case ([BEY-133](../increments/active/bey-133-use-case-proposals/design.md)) is read
by the organization that posted the use case, which decides on it and then tells the senders. This is not the review of
program applications above. The code is `UseCaseProposals` (`posted` is its authorization: a member of the posting
organization, or an operator; anyone else finds no such use case or proposal).

- **State.** `use_case_proposal` (V93) holds `decision` (`shortlisted`, `declined`, or null while undecided), `decided_at`,
  `decided_by_account_id`, and `outcome` with `outcome_sent_at`, the decision last told to the sender. Checks: the three
  decision columns are all set or all null, so are the two outcome columns, and a decision exists only while the status is
  `sent`. `use_case_proposal_decision` appends one row (decision, who, when) for every change; it is never updated, and it
  stays when a proposal is withdrawn.
- **Deciding.** `POST /api/proposal/use-case-proposals/{id}/decision` (`decideUseCaseProposal`, body `{decision}`) needs a
  sent proposal (otherwise `PROPOSAL_NOT_FOUND`). The decision may change between `shortlisted` and `declined` at any time,
  after the outcomes were sent and after the use case closed, but never back to undecided. The same decision again changes
  and records nothing. Deciding sends no email. It records the audit event `use_case_proposal.decide` (`decision`) on a
  resource of type `use_case_proposal`. The answer is the proposal's line, `ReceivedUseCaseProposalSummary`.
- **What the posting side reads.** The list and the single read carry `decision`, `decidedAt`, `decidedBy` (display name),
  `outcomePending` (a decision is set and is not the one last told) and `outcomeSentAt`. The list also carries the counts
  `shortlisted`, `declined` and `pending` (proposals with an outcome to send).
- **Sending the outcomes.** `POST /api/proposal/use-cases/{useCaseId}/outcomes` (`sendUseCaseProposalOutcomes`, body
  `{message}`, at most 2000 characters, optional) is one batch in one transaction: it locks the use case's sent proposals,
  queues one email to the sender of each proposal with `outcomePending` (`proposal_shortlisted` or `proposal_declined`,
  quoting the message) and sets `outcome` and `outcome_sent_at`. Undecided proposals and those already told the same
  decision are left out. It answers `{sent, shortlisted, declined}`, and `PROPOSAL_NOTHING_TO_SEND` when nothing is
  pending, so a second call finds nothing. It records `use_case_proposal.outcomes_send` (`sent`, `shortlisted`, `declined`)
  on a resource of type `use_case`.
- **What the sender reads.** The form's proposal carries `outcome` and `outcomeSentAt`: the decision last told, null
  before. A decision not yet sent is never shown. A shortlisted proposal can still be withdrawn; withdrawing clears the
  decision and the outcome and leaves the history rows.
- **The PDF.** The proposal's PDF is read, never listed, through the proposal: `GET /api/proposal/use-case-proposals/{id}/file`
  (`getUseCaseProposalFile`) for the posting side (`posted`: the posting organization's members and operators), and `GET
  /api/proposal/use-cases/{useCaseId}/proposal/file` (`getOwnUseCaseProposalFile`) for the members of the organization that
  wrote it, a draft or a sent one; an organization with no proposal to the use case, or none with a PDF, finds
  `PROPOSAL_NOT_FOUND`. Both answer `StorageService.download`: the bytes saved under the name, or a redirect to the object
  store. The page opens them in the full-screen `PdfViewer` (the same viewer as an application's files, see
  [Reviewing](#reviewing)) and keeps the download beside it; the viewer reads the file with the request of the page, so
  nothing is served inline. A PDF just uploaded and not yet saved opens from the browser's own copy of it.

## Events

| Event               | Published                   | Carries                                                                               | Handled by       |
| ------------------- | --------------------------- | ------------------------------------------------------------------------------------- | ---------------- |
| `ProposalSubmitted` | Each submission             | application, program, organization, version, recipient, program name, `editableUntil` | `SubmissionMail` |
| `ReviewerInvited`   | Each invitation and re-send | invitation, email, program, program name, inviter name, expiry (package-private)      | `ReviewMail`     |
| `OutcomesReleased`  | The release                 | program, and per applicant the decision, recipient, subject and message               | `ReviewMail`     |

The handlers are `@EventListener`s that queue email in the publisher's transaction through `EmailService`
([ADR 0005](../decisions/0005-operators-run-email-delivery.md)).

## HTTP

Every endpoint needs a session, except `GET /api/proposal/use-case-proposal-counts`.

| Method and path                                                                | Contract                                                           |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `GET /api/proposal/programs/{slug}/application`                                | The form, the caller's application and organization                |
| `PUT /api/proposal/programs/{slug}/application`                                | Save the working copy (`SaveApplication`)                          |
| `POST /api/proposal/programs/{slug}/application/organization`                  | Make the organization of an individual or a team                   |
| `POST /api/proposal/programs/{slug}/application/organization/leave`            | Leave an individual organization nothing was sent under            |
| `GET /api/proposal/applications`                                               | My applications                                                    |
| `GET /api/proposal/applications/{id}`                                          | One of the caller's applications with its form                     |
| `POST /api/proposal/applications/{id}/submit`                                  | Submit, or submit again                                            |
| `POST /api/proposal/applications/{id}/withdraw`                                | Withdraw                                                           |
| `GET /api/proposal/review/programs`                                            | The programs the caller reviews, with counts and whether released  |
| `GET`, `PUT /api/proposal/review/programs/{programId}/criteria`                | Read the criteria; an operator replaces them                       |
| `GET`, `POST /api/proposal/review/programs/{programId}/reviewers`              | An operator lists judges or invites one                            |
| `POST /api/proposal/review/programs/{programId}/reviewers/{reviewerId}/resend` | Re-send an unused invitation                                       |
| `DELETE /api/proposal/review/programs/{programId}/reviewers/{reviewerId}`      | Remove a judge                                                     |
| `GET /api/proposal/review/programs/{programId}/applications`                   | The submitted applications as the caller reviews them              |
| `POST /api/proposal/review/programs/{programId}/applications/export`           | The submitted applications as XLSX or CSV, for operators; recorded |
| `GET /api/proposal/review/programs/{programId}/drafts`                         | The drafts not submitted, for operators                            |
| `POST /api/proposal/review/programs/{programId}/drafts/export`                 | The drafts as XLSX or CSV, for operators; recorded                 |
| `GET /api/proposal/review/drafts/{id}`, `…/drafts/{id}/files/{fileId}`         | One draft as it stands, and its files, for operators               |
| `POST /api/proposal/use-cases/{useCaseId}/proposals/export`                    | A use case's proposals as XLSX or CSV, for operators; recorded     |
| `GET /api/proposal/review/applications/{id}`                                   | One application as submitted last, with assessments and history    |
| `PUT /api/proposal/review/applications/{id}/assessment`                        | Save the caller's assessment                                       |
| `GET /api/proposal/review/applications/{id}/files/{fileId}`                    | A file of the last submission                                      |
| `POST /api/proposal/review/programs/{programId}/decisions`                     | Decide one application or several                                  |
| `GET`, `POST /api/proposal/review/programs/{programId}/release`                | Preview the release; release                                       |
| `PUT /api/proposal/review/programs/{programId}/release/draft`                  | Keep the release emails as they are written                        |
| `GET`, `PUT /api/proposal/use-cases/{useCaseId}/proposal`                      | The caller's proposal form; keep what it holds                     |
| `POST /api/proposal/use-case-proposals/{id}/send`, `/withdraw`                 | Send the proposal; take a sent one back                            |
| `GET /api/proposal/use-cases/{useCaseId}/proposals`                            | The proposals a use case received                                  |
| `GET /api/proposal/use-case-proposals/{id}`, `…/{id}/file`                     | One received proposal, and its PDF                                 |
| `GET /api/proposal/use-case-proposal-counts`                                   | How many proposals each use case received; no session needed       |
| `GET /api/proposal/use-cases/{useCaseId}/proposal/file`                        | The PDF of the caller's own organization's proposal                |
| `POST /api/proposal/use-case-proposals/{id}/decision`                          | Shortlist or decline a received use-case proposal                  |
| `POST /api/proposal/use-cases/{useCaseId}/outcomes`                            | E-mail the outcomes not yet told, in one batch                     |

## Error codes

`ProposalErrorCode`; the category sets the status (validation 400, not permitted 403, not found 404, conflict 409).

| Status | Codes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400    | `PROPOSAL_ORGANIZATION_REQUIRED`, `PROPOSAL_CONTACT_INCOMPLETE`, `PROPOSAL_TEAM_BACKGROUND_REQUIRED`, `PROPOSAL_SOLUTION_NOT_FOUND`, `PROPOSAL_SOLUTION_REQUIRED`, `PROPOSAL_SOLUTION_INCOMPLETE`, `PROPOSAL_DECK_REQUIRED`, `PROPOSAL_ANSWER_INVALID`, `PROPOSAL_ANSWER_REQUIRED`, `PROPOSAL_CRITERIA_INVALID`, `PROPOSAL_ASSESSMENT_INVALID`, `PROPOSAL_APPROACH_REQUIRED`, `PROPOSAL_CONTACT_REQUIRED`, `PROPOSAL_PDF_REQUIRED`                                                                                                                       |
| 403    | `PROPOSAL_OWN_APPLICATION`, `PROPOSAL_REVIEW_NOT_ALLOWED`, `PROPOSAL_OWN_USE_CASE`, `PROPOSAL_NO_ORGANIZATION`                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 404    | `PROPOSAL_APPLICATION_NOT_FOUND`, `PROPOSAL_REVIEW_PROGRAM_NOT_FOUND`, `PROPOSAL_REVIEWER_NOT_FOUND`, `PROPOSAL_USE_CASE_NOT_FOUND`, `PROPOSAL_NOT_FOUND`                                                                                                                                                                                                                                                                                                                                                                                                |
| 409    | `PROPOSAL_NOT_OPEN`, `PROPOSAL_CLOSED`, `PROPOSAL_LOCKED`, `PROPOSAL_WITHDRAWN_FOR_GOOD`, `PROPOSAL_CHANGED_MEANWHILE`, `PROPOSAL_ALREADY_IN_ORGANIZATION`, `PROPOSAL_INDIVIDUAL_LOCKED`, `PROPOSAL_ORGANIZATION_APPLIED`, `PROPOSAL_NOT_SUBMITTED`, `PROPOSAL_CRITERIA_FIXED`, `PROPOSAL_NO_CRITERIA`, `PROPOSAL_REVIEWER_INVITED`, `PROPOSAL_REVIEWER_JOINED`, `PROPOSAL_RELEASED`, `PROPOSAL_OUTCOMES_NOT_READY`, `PROPOSAL_NOTHING_TO_SEND`, `PROPOSAL_NOT_SENT`, `PROPOSAL_ALREADY_SENT`, `PROPOSAL_EDIT_WINDOW_CLOSED`, `PROPOSAL_USE_CASE_CLOSED` |
