# Evaluation board: an AI-suggested shortlist tier for every submission to a program

Status: approved by Đạt on 21 October 2026; being implemented. Tracked in Linear as BEY-234. The method is Kai's ([shortlisting methodology](../../../brief/tasco-evaluation-board/shortlisting-methodology.md), [detailed methodology](../../../brief/tasco-evaluation-board/evaluation-methodology-detailed.md), received 20 October 2026). What was read before this design is in [Evaluation board research](../../../research/2026-10-20-evaluation-board.md). The screens follow the prototype Đạt approved on 21 October (`.tmp/evaluation-board-prototype.html`, drawn from the live Applications, Matched solutions and application pages); no Figma, by Đạt's decision.

## Why

A program such as the AI for Insurance Challenge × Tasco receives about fifty submissions and keeps ten. Operators read every form, deck and proposal to decide, and Kai did it by hand for 48 of them between 16 and 19 October. He asked for the platform to do the reading: for each submission, review it against the enterprise's use case, label the evidence behind each finding, and suggest a shortlist tier with its reasons, without ever deciding.

Kai confirmed on 20 October that the AI suggests the tier itself, and that both routes count: program applications and proposals sent directly to the program's use case.

## What an operator can do

On a program's page, a new tab **Evaluations** sits between Applications and Reviewers, for operators only.

- **See the run.** One line says what the AI is doing ("AI is assessing 2 candidates · 12 of 14 assessed · model …") and links to the run. "Assessed against" opens the use case's brief the candidates were read against.
- **Scan.** Tabs by tier with counts (All, Strong Match, Potential Match, To consider, Strong No); search; filters for alignment, the operator's decision (To decide, Shortlisted, Not selected) and state (needs attention, provisional, decision differs from the AI). A row is one candidate: name and organization, the tier as a coloured badge with the alignment under it, the main concern, the decision. Sorting by name, tier or decision.
- **Read one.** A row opens the candidate beside the list (a sheet below 1280px): the records it combines with their status and links, the tier, alignment and Provisional, why consider, main concern, next step, then the six criteria. A criterion opens its findings: the label, the finding, what is still missing and its sources. A source opens the file at its page with the quoted words marked, or the form's answer. "Why this tier", "What was read" and "Earlier suggestions" are collapsed below.
- **Decide.** The panel ends with **Decision**: Shortlist and Not selected for the program application, Shortlist and Decline for a use-case proposal, one row per record, each calling the decision that record already has. A draft has nothing to decide. "Go to next" moves on after a decision; Undo is offered.
- **Move fast.** J/K or the arrows move between candidates, S and N decide, Enter opens the full page, `/` searches, Esc closes.
- **Compare.** Two to four selected candidates side by side: tier, why, concern, each criterion with its label and sources, next step, decision.
- **Full page.** One candidate on its own page, with Previous and Next, for reading at length.

Nothing on the board decides, shortlists, declines or emails. The applicant never sees the suggestion.

## Domain story

1. A program has use cases attached (`use_case_program`). Those that are approved are the brief its candidates are read against.
2. Something changes: an application is submitted or edited after submission, a proposal is sent or edited to one of those use cases, a use case is attached or detached, or a brief changes. Matching queues an **evaluation run** for the program, which waits `settle minutes` after the last change, as a matching run does.
3. The run gathers the program's **candidates**. A candidate is an organization with one solution: its submitted program application (the last submitted version), and the proposals it sent to the program's use cases that name that solution. One organization with two solutions is two candidates. A draft application is listed as a record but not read as the candidate's case.
4. For each candidate whose material or brief changed, the model reads, under labels: the use cases' briefs and requirements, the application's answers by question, its deck page by page, each proposal's approach, team and PDF page by page, and the profile of the solution. It answers in one structured reply: alignment, the six criteria with one or more findings each (label, finding, gap, sources), the proposal gate and early-stage route, tier, provisional, why consider, main concern, next step, and the pages it could not read.
5. Code checks every quote against those texts, as matching does, and keeps the **assessment**, appended, with the model and the prompt version. A candidate whose material did not change is not asked again.
6. Operators read the board. Their decisions stay on the records.

Failure and recovery are a run's: a refusal waits and goes on, a run that keeps failing ends as failed and names the candidates it could not assess, and an operator can start one again from the board.

## The assessment

| Part          | What it holds                                                                                                                                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alignment     | `direct`, `industry`, `technology` or `none`, with one sentence on the connection to the brief                                                                                                                                      |
| Criteria      | `team`, `traction`, `readiness`, `product`, `funding`, `proposal`; each has one or more findings                                                                                                                                    |
| Finding       | `label` (`documented`, `claimed`, `not_disclosed`, `contradictory`), `summary` (a short line), `finding`, `gap`, `sources` (label and page, as `application · Traction`, `deck p.7`, `proposal 1 p.3`, `solution profile`), `quote` |
| Traction kind | `same_use_case`, `adjacent_product`, `active_pilot`, `prototype_only`, `not_substantiated`                                                                                                                                          |
| Gate          | `passed` or `failed`, and the early-stage route: `not_needed`, `team`, `prototype`, `not_substantiated`                                                                                                                             |
| Tier          | `strong_match`, `potential_match`, `to_consider`, `strong_no`; `provisional` when it waits on a demonstration                                                                                                                       |
| Notes         | `why`, `concern`, `next` (about 18 words each), `rationale`, `contradictions` and `questions` to ask                                                                                                                                |
| Coverage      | each record and file read: pages read of pages held, pages unread with the reason, identical files counted once                                                                                                                     |

Rules the code enforces, whatever the model answers:

- A finding whose quote is in none of the texts read becomes **Claimed** with "quote not found"; code never raises a label.
- A finding on a page that could not be read says so, and the assessment lists the page in its coverage.
- Funding never decides: the prompt says so, and the rationale may not cite funding as the reason for Strong No (checked in the prompt's tests).
- An assessment is never edited; a new one is appended, with what changed ("they resubmitted with a demo link").

## Decisions

1. **The AI suggests a tier on this board.** BEY-229 kept AI scores and recommendations off the comparison of received proposals, and BEY-213 keeps judges' scores the people's own. Kai asked for a suggested tier on 20 October for shortlisting, which comes before judging. The tier is shown only here, to operators, beside the decision it never sets; the received proposals page and the judges' screens do not change.
2. **Matching owns evaluation.** The reading of files, the vision fallback for image-only pages, the quote check, the worker with its limits and refusals, the model chosen per task and the record of calls are in `matching`. An evaluation run is a second kind of run there. `matching` already reads `proposal` (applications and proposals) and `usecase` (a program's use cases and their briefs), so no new module edge is needed.
3. **Runs per program, not per use case.** A program application belongs to the program, not to one of its use cases, and a candidate can come through both routes. A run of the program assesses every candidate once against all the program's approved use cases. A use case attached to no program is not assessed here.
4. **One candidate, several records.** An organization with one solution is one row, whichever routes it used, so a finished proposal is not hidden behind an unfinished application (Kai's Overleap case). Each record keeps its own status and its own decision.
5. **Decisions stay where they are.** Shortlist and Not selected call `OutcomeService.decide` for an application; Shortlist and Decline call `UseCaseProposals.decide` for a proposal. The board adds no shortlist of its own, as Kai's mockup does ("System assessment only. Your shortlisting decision is separate.").
6. **The submitted version is read.** An application is read from its last submitted snapshot; a proposal as sent. An edit after submission makes the assessment "Edited since" until the next run.
7. **A model of its own.** A new `AiTask.EVALUATION` (reasoning medium) lets operators choose its model in Admin › AI apart from matching. Claude Sonnet 5.5 to start, at about $0.15 a candidate; Opus 5.5 is compared on the Tasco submissions before the choice is settled.
8. **Prompts as versioned constants**, as in matching, written from Kai's methodology. Labels and tiers in English on both languages' pages, as matching's words are.

## Data

Migrations `V107` (the `evaluation` task of `ai`, starting on matching's model) and `V108` (the tables below), numbers checked against `main` before the merge:

- `evaluation_run`: `id`, `program_id`, `state` (`queued`, `running`, `waiting`, `done`, `failed`), `origin` (`change`, `operator`), `started_by_account_id`, `prompt_version`, `model_name`, `stalls`, `resume_at`, `not_before`, `failure`, `assessed`, `total`, timestamps; at most one open run per program.
- `evaluation_assessment`: `id`, `program_id`, `organization_id`, `solution_id`, `records jsonb` (kind, id, version or sent stamp), `fingerprint`, `tier`, `alignment`, `provisional`, `notes jsonb`, `criteria jsonb`, `gate jsonb`, `coverage jsonb`, `change_note`, `run_id`, `model_name`, `prompt_version`, `assessed_at`; unique on (`program_id`, `organization_id`, `solution_id`, `run_id`), so an operator's run that assesses everything again adds one even when nothing changed; the latest per candidate is the current one.
- `evaluation_run_step`, as `matching_run_step`: calls, tokens and cost per candidate, shown with the run.

## HTTP

| Request                                                | Who      | Answer                                                                                                                                                                                       |
| ------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/admin/programs/{id}/evaluations`             | Operator | The run's state, the use cases read against, and for each candidate: organization, solution, records with status and decision, the current assessment (or `assessing`, `failed`, `outdated`) |
| `GET /api/admin/programs/{id}/evaluations/{candidate}` | Operator | One candidate with its current assessment and the earlier ones                                                                                                                               |
| `POST /api/admin/programs/{id}/evaluations/runs`       | Operator | Starts a run now; refused while one is open                                                                                                                                                  |

Decisions use the existing endpoints of applications and proposals. A file at a page uses the existing file endpoints.

## Screens

As the approved prototype, in the admin's own components: page tabs, count tabs and filter toolbar of Applications; `data-table`; the tier as `Badge` (`success` Strong Match, `info` Potential Match, `warning` To consider, `destructive` Strong No); labels as `Status` pills (`info` Documented, `warning` Claimed, `neutral` Not disclosed, `destructive` Contradictory); the panel beside the list from 1280px and a sheet below, as `matching-board`; the Decision card of an application; a file opened at its page with the quote marked, as `matching-deck`. At 390 a row becomes a card and the decision bar stays at the foot of the sheet. English and Vietnamese.

## Decided with Đạt on 21 October

- The tier is shown only on this board, to operators; the received proposals page and the judges' screens do not change.
- Runs start by themselves after a change, once the program has been quiet for the settle time; a candidate whose material did not change is not asked again.
- Applications are read against all the program's approved use cases; a program with none says "Attach a use case to assess" and runs nothing.
- A candidate is an organization with one solution: one company that applied with one product and proposed another is two rows.

## Open questions for Kai

1. A program application names no use case. Is it read against all the program's approved use cases (this design), or against one the applicant picks?
2. Should a program with no use case be assessed against the program's own description instead, or show "Attach a use case to assess"? This design shows the latter.

## Out of scope

- The enterprise seeing the board; judges seeing the tier.
- External verification (checking a customer named in a deck); the board shows only what was submitted.
- Importing Kai's 48 evaluations; they are compared offline on the first run and stay out of the repository.
- Bulk decisions from the board, an export of the board, live updates while a run is reading.
