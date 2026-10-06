# Proposals: applying to a program

Status: accepted 6 October 2026. Tracked in Linear as BEY-37. The domain behind it is [BEY-22](../bey-22-phase-1-domain-model/design.md); the screens are the Apply flow of [BEY-27](../bey-27-main-flows-design/design.md), revised and approved on 6 October 2026.

A person reads an open program, signs in, applies in four steps and follows the outcome. Reviewing the applications is the next increment (BEY-38).

## What a person can do

- **Start an application** from a program that takes applications on BeyondPilot while its window is open. Signing in comes first and returns to the form. One person has one application per program.
- **Say who applies** (step 1). A person already in an organization applies for it, whether or not GenAI Fund has reviewed it yet. A person in none chooses:
  - _Individual_: a one-person organization is made from their name and country, with nothing more to fill in. Judges see "Dat Phan · Individual".
  - _Team_: a team name, its size and country.
  - _Company_: find the company on BeyondPilot and join it (at once on a matching email domain; otherwise its owner lets them in, and the draft waits), or add it.
    Contact details (name, phone, country, LinkedIn) and the team's background belong to the application, and the next application starts from them.
- **Bring a solution** (step 2): one the organization already has, or a new one. What is entered here is the solution's profile, deck and demo included, so it is entered once and reused.
- **Answer the program's questions** (step 3): the questions an operator set for this program. A program without questions has no step 3.
- **Review and submit** (step 4) before the window closes. A copy goes by email. The application can be changed and submitted again until the window closes; each submission is a version, and reviewers read the latest.
- **Withdraw** before the window closes, and submit again later if the window is still open.
- **Follow it** in My applications and on the application's page.

## Decisions

1. **Review decides listing, not taking part** (changes BEY-33). An organization or a solution waiting for GenAI Fund's review can do everything except appear in the public directory. The brief keeps "public listing approval" apart from "application eligibility", and an applicant must not wait for a review near a deadline. A solution is in the directory only when it is approved and listed and its organization is approved.
2. **Every member writes the organization's solutions** (changes BEY-33). Owners keep the profile and the members. A person who joined a company can then bring its solution to an application without waiting for an owner.
3. **A one-person or team organization is light** (changes BEY-33). Industries are required of a company only, and a creator's job title is optional. An individual's organization is made by the application, not by a form.
4. **A solution holds its deck, demo link, what it is built with and its traction** (changes BEY-33). They describe the solution, so they are reused; the deck is private (`application_file`), like every file of an application.
5. **The application keeps what it was given.** Each submission stores a snapshot of the applicant, the organization, the solution and the answers. A later change to a profile leaves a submitted version unchanged ("historical submissions must remain understandable when a profile changes", brief §8).
6. **The working copy is one record.** A draft holds the contact details, the team's background and the answers as JSON, validated by the application service against the program's questions. Versions hold their snapshot as JSON too. Answers are read whole, never queried one by one, so separate answer rows would add joins and nothing else.
7. **Questions belong to the program and are fixed once applications open.** An operator edits them in Settings until the window opens; after that a change could invalidate answers already given. Kinds: short text, long text, one choice, file, link, confirmation.
8. **The deadline is the program's instant.** `closes_at` is stored as an instant and entered in Vietnam time, so "before the close" needs no time zone at the moment of submission. A save or a submission at or after it is refused.
9. **The AI for Insurance Challenge keeps its interim form until it closes on 15 October.** Its Apply still leads there; its applications are imported afterwards, in their own issue.

## Boundary discovery

| Question                       | `proposal`                                                                                                                                                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| What does it own?              | Applications, their working copy, their versions and their status                                                                                                                                                                                                        |
| Who changes its data?          | The applicant; operators from BEY-38 on                                                                                                                                                                                                                                  |
| What does it need from others? | `program` (whether it takes applications now, its questions), `organization` (the caller's organization, making one for an individual), `solution` (the organization's solutions, saving one), `storage` (files), `notification` (the confirmation), `identity`, `audit` |
| What do others need from it?   | Nothing yet; BEY-38 reads it, `matching` later listens to `ProposalSubmitted`                                                                                                                                                                                            |
| Why not part of `program`?     | A program is published by operators; an application is written by an applicant and has its own lifecycle and privacy                                                                                                                                                     |

New dependency edges: `proposal → program, organization, solution, storage, notification, identity, audit`. Nothing points back.

## Data

`V11` changes `organization` and `solution` (decisions 1 to 4). `V12` adds `program_question`: `program_id`, `position`, `kind`, `label`, `help`, `required`, `options jsonb`, `max_length`. `V13` adds:

| Table              | Columns                                                                                                                                                                                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `proposal`         | `program_id`, `account_id`, `organization_id` (null until step 1), `solution_id` (null until step 2), `status` (`draft`, `submitted`, `withdrawn`), `contact jsonb`, `team_background`, `answers jsonb`, `submitted_at`, `withdrawn_at`, `version`; unique on `program_id, account_id` |
| `proposal_version` | `proposal_id`, `number`, `submitted_at`, `snapshot jsonb`                                                                                                                                                                                                                              |

## HTTP

| Path                                                                    | Use                                                                |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `GET`, `PUT /api/program/admin/programs/{id}/questions`                 | An operator reads and replaces a program's questions               |
| `GET /api/proposal/programs/{slug}/application`                         | The caller's application to a program, made when it does not exist |
| `PUT /api/proposal/applications/{id}`                                   | Save the working copy (one step or several)                        |
| `POST /api/proposal/applications/{id}/organization`                     | Step 1 for someone in no organization: individual or team          |
| `POST /api/proposal/applications/{id}/submit`                           | Submit, or submit again                                            |
| `POST /api/proposal/applications/{id}/withdraw`                         | Withdraw                                                           |
| `GET /api/proposal/applications`, `GET /api/proposal/applications/{id}` | My applications and one of them                                    |

Finding and joining a company and saving the solution use the endpoints of `organization` and `solution`.

## Web

| Route                                 | Screen                                                      |
| ------------------------------------- | ----------------------------------------------------------- |
| `/programs/[slug]/apply`              | Steps 1 to 4 (`?step=`), saving as the applicant goes       |
| `/programs/[slug]/apply/submitted`    | The receipt                                                 |
| `/applications`, `/applications/[id]` | My applications and one application, with Edit and Withdraw |
