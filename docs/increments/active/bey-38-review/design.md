# Proposals: reviewing applications and releasing outcomes

Status: accepted 6 October 2026. Tracked in Linear as BEY-38. It follows [BEY-37](../bey-37-proposal/design.md), which lets a person apply; the domain is [BEY-22](../bey-22-phase-1-domain-model/design.md). The screens are O1–O3 of [BEY-27](../bey-27-main-flows-design/design.md), revised on 6 October 2026 after the [research on judging](../../../research/2026-10-06-review-and-judging.md).

GenAI Fund and the judges it invites score the applications of a program on its criteria; GenAI Fund decides who is shortlisted and tells every applicant on the same day.

## What people can do

- **An operator sets a program's judging criteria**: a name and what it means, in order. They are fixed once the first assessment is saved, so every score of a program is on the same criteria.
- **An operator invites judges to a program** by email. The email carries no link that acts: the person signs in with that address and finds the program's applications under Reviews. An invitation not used within 7 days lapses and can be sent again. A removed judge loses access; their scores stay.
- **A judge or an operator scores an application**: each criterion from 1 to 5 and a private note, on the version the applicant submitted last. They change their score until the outcomes are released. A judge who knows the applicant declares a conflict instead, and their score is left out.
- **An operator reads every score** with its version and its author; a judge reads only their own.
- **An operator decides**: shortlisted or not selected, with a private reason, for one application or several. A decision changes until the outcomes are released; each change is kept.
- **An operator releases the outcomes of a program** once its applications have closed and every submitted application has a decision. Each applicant gets the email of their group, which the operator writes, and sees Shortlisted or Not selected on My applications and on the application's page. A release is final.

## Decisions

1. **Review belongs to `proposal`** (BEY-22): a program such as the AI for Insurance Challenge has no use case, and reviewing needs no AI. The criteria are the review's, so they live in `proposal` beside the scores that depend on them; `program` is unchanged.
2. **Several criteria, each 1–5, averaged; no weights.** Competitions judge on several criteria and average across judges (research, patterns 3); Agentic AI Build Week judged six. An application's score is the mean of the judges' means. Weights wait until a program asks for them.
3. **Judges never see each other's scores.** It is the default everywhere (research, pattern 4) and keeps each score independent. Operators see all of them.
4. **A judge's access is an invitation to their address for one program.** Like an organization invitation (BEY-33), it is matched to the address the person signs in with, so no link carries a secret. A judge sees the program's submitted applications and nothing else in the admin area. Operators review every program without an invitation.
5. **Judges score the last submitted version**, not the working copy. An assessment records the version it was made on, so a score made before the applicant submitted again is marked as such (research, pattern 10: Submittable Next tags later edits).
6. **Withdrawn applications and drafts are not reviewed.** The list counts them under the table.
7. **Decisions are an internal state; the outcome is what is released.** The applicant sees nothing of the review until the release (brief §7.7); then their outcome is the decision, and scores, notes and reasons never reach them.
8. **A release waits for the close and for every decision**, so every applicant of a program hears on the same day and nobody applies after the results. It is final: an email cannot be taken back.
9. **Decisions, releases and judges' access are audited** (new edge `proposal → audit`). They are the operators' most consequential acts; the decision history stays on the application's page as well.

## Boundary discovery

The module exists. What changes:

| Question                       | `proposal`                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| What does it own now?          | Also: a program's judging criteria, its judges, the assessments, the decisions and the release     |
| Who changes its data?          | Applicants; operators; invited judges (their own assessments only)                                 |
| What does it need from others? | As before, plus `audit`; `program` for a program's name, questions and close; `identity` for names |
| What do others need from it?   | Nothing yet; `matching` later reads outcomes                                                       |

New dependency edge: `proposal → audit`.

## Data

`V17` adds:

| Table                      | Columns                                                                                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `proposal` (new columns)   | `review_status` (`under_review`, `shortlisted`, `not_selected`)                                                                                                 |
| `review_criterion`         | `id`, `program_id`, `position`, `name`, `description`                                                                                                           |
| `proposal_reviewer`        | `id`, `program_id`, `email`, `account_id` (set when they first open the review), `invited_by_account_id`, `invited_at`, `expires_at`, `joined_at`, `removed_at` |
| `proposal_assessment`      | `proposal_id`, `account_id`, `version_number`, `scores jsonb` (by criterion), `note`, `conflict`, `saved_at`; one per application and person                    |
| `proposal_review_decision` | `id`, `proposal_id`, `account_id`, `from_status`, `to_status`, `reason`, `decided_at`; append-only                                                              |
| `proposal_release`         | `program_id`, `released_at`, `released_by_account_id`, and for each group the subject and message that were sent                                                |

## HTTP

| Path                                                                      | Use                                                             |
| ------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `GET /api/proposal/review/programs`                                       | The programs the caller reviews                                 |
| `GET`, `PUT /api/proposal/review/programs/{programId}/criteria`           | A program's criteria; an operator replaces them                 |
| `GET`, `POST /api/proposal/review/programs/{programId}/reviewers`         | A program's judges with their progress; an operator invites one |
| `POST …/reviewers/{reviewerId}/resend`, `DELETE …/reviewers/{reviewerId}` | Send an invitation again; remove a judge                        |
| `GET /api/proposal/review/programs/{programId}/applications`              | The submitted applications with their scores and counts         |
| `GET /api/proposal/review/applications/{id}`                              | One application as submitted, its assessments and its history   |
| `PUT /api/proposal/review/applications/{id}/assessment`                   | Save the caller's assessment                                    |
| `POST /api/proposal/review/programs/{programId}/decisions`                | Decide one application or several                               |
| `GET`, `POST /api/proposal/review/programs/{programId}/release`           | What a release would send and whether it can; release           |

An applicant's application and My applications carry the outcome once it is released.

## Web

| Route                                                                      | Screen                                                                   |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `/admin/programs/[id]/applications`                                        | O1: the applications of a program, with tabs, filters and bulk decisions |
| `/admin/programs/[id]/applications/[applicationId]`                        | O2: one application, the assessment, the scores and the decision         |
| `/admin/programs/[id]/release`                                             | O3: the groups, their emails and the release                             |
| `/admin/programs/[id]/reviewers`                                           | The judges and the criteria                                              |
| `/reviews`, `/reviews/[programId]`, `/reviews/[programId]/[applicationId]` | A judge's programs, their applications and scoring one                   |
