# Reviewing applications: plan

Design: [design.md](design.md). Tracked in Linear as BEY-38.

| #   | Step                                                                                                                            | State |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | Research, this design and plan; Figma O1–O3 revised with criteria, judges and the applicant's outcome                           | Done  |
| 2   | Backend: `V16`; a program's criteria; inviting, sending again and removing judges, with the invitation email and the audit      | To do |
| 3   | Backend: the applications to review, one application as submitted, saving an assessment, a conflict                             | To do |
| 4   | Backend: decisions, the release with its emails, the outcome shown to the applicant; `openapi.yml` and the web client refreshed | To do |
| 5   | Web for operators: the Applications, Reviewers and Release screens and the review of one application                            | To do |
| 6   | Web for judges: Reviews, their applications and scoring one                                                                     | To do |
| 7   | Web for applicants: the outcome on My applications and the application's page; end-to-end tests                                 | To do |
| 8   | Documents made true: `docs/tests/proposal.md`, `ARCHITECTURE.md`, the audit catalog                                             | To do |

Each step is one or more commits, pushed as it is finished, on one branch with one pull request.

## Verification

- `./gradlew :backend:check`, the review tests speaking HTTP against PostgreSQL:
  - an operator sets criteria, invites a judge, the judge signs in with that address and scores; criteria are refused once a score exists;
  - a judge sees only their invited program and only their own score; a removed judge and a lapsed invitation are refused;
  - a score misses a criterion or is out of 1–5 and is refused; a conflict is saved without scores and left out of the average;
  - a score records its version; a decision is kept in the history; a release before the close or with an undecided application is refused; a release sends one email per applicant after commit and shows the outcome to the applicant only then.
- `pnpm --dir web check` and the end-to-end tests at desktop and mobile widths, with axe.

## Needed from outside the code

| What                                                                             | For                                       | Where it is managed |
| -------------------------------------------------------------------------------- | ----------------------------------------- | ------------------- |
| Whether the Tasco challenge is judged on BeyondPilot, by whom, on which criteria | Judging Tasco on 16 October               | Asked in BEY-41     |
| The export of the interim form's applications                                    | Importing the Tasco applications to judge | Asked in BEY-41     |
