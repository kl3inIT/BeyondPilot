# Matching

For one published use case, the solutions on BeyondPilot that fit it, each with the reasons a person can check, and what people then decide on them. Designed in [BEY-39](../increments/active/bey-39-matching/design.md) and decided in [ADR 0007](../decisions/0007-a-matching-module-that-reads-through-search.md). This page says what exists; the screens are not built yet.

## Module

- **`matching` is a closed module** that depends on `ai`, `audit`, `identity`, `organization`, `search`, `solution` and `usecase`. Nothing depends on it. `MatchingService` is what people use; `MatchingAdministration` is the limits operators set.
- **It owns** `matching_requirement`, `matching_run`, `matching_run_step`, `matching_candidate` and `matching_decision` (V60), and `matching_settings` (V63).
- **It reads** a use case's whole brief with its attached files (`UseCaseDirectory.brief`), a solution's profile (`SolutionDirectory.indexed`), the solutions that answer a set of queries, the passages of one solution and how solutions are named (`SolutionEvidence` in `search`), a chat client for the task `matching` (`AiModels.chat`), who is an operator (`IdentityService`) and which organization a person belongs to (`OrganizationDirectory.membershipOf`).

## A run

A run is a row of `matching_run` that a worker takes, one run at a time, every `beyondpilot.matching.interval` (10 seconds). The worker works on a thread of its own, because scheduled work shares one thread and a run takes minutes.

- **Queued by a change.** When a use case is published or changed (`UseCaseChanged`), if a model is chosen for the task and the brief is not the one a finished run read, a run is queued to start once the use case has stayed unchanged for `settle minutes`: another change moves that moment instead of queuing again. The changes of one use case queue at most `edit runs per day`; past that the brief is saved and the candidates stay those of the earlier brief. A brief that changed while a run worked queues the next when it ends.
- **Queued by a person.** An operator, or a member of the use case's approved organization, starts a run; a run that waits for its moment starts at once instead. Members start at most `member runs per day` for one use case. Only an operator has every candidate judged again, which is how a new model is applied. A use case has at most one run that has not ended.
- **Taken by the worker** one at a time. No more than `runs per day` start in a day (UTC); a run over it stays queued for the next day, and a run that already started goes on whatever the limit.
- **Requirements.** One call lists what the brief asks for: capabilities (what the product does, to what, and what for) and constraints (the conditions of delivery), each with the words of the brief it comes from. Only the heart of the problem is a required capability, usually one; a step on the way to it, an alert, a report or an analysis around it is optional, and what the brief asks under integration, deployment or security is a constraint. The brief is the use case's text, the requirements its organization listed, and the text of its attached PDFs (40 pages a file, 40,000 characters in all; a page that is only a picture is read by the model of the task `document_reading` when one is chosen). A requirement of an unknown kind, or whose quote is not in the brief, is not kept. They are kept with the fingerprint of the brief, and a brief that did not change asks nothing.
- **Candidates.** The title and each capability are a query. `search` answers each by its words and by its meaning, over the solutions' profiles and over the passages of their decks, websites and customer cases, and the queries are fused by adding their scores. The first `candidates` are kept, unlisted solutions included, and never a solution of the use case's own organization. A candidate a later run no longer finds is taken out, unless a person decided on it. What an operator added by hand is judged with what the run found.
- **Judgment.** One call a candidate, `parallel` (4) at a time. The model reads the solution's sources under their labels (`profile`, `customer case 1`, `deck p.3`, `website 2`; a deck to 30,000 characters, a website to 24,000 and 8,000 a page), then the use case, its problem and its requirements. For each requirement it gives a quote, its source, a reason in one sentence, and `met`, `partly` or `not_shown`: `met` when the quote shows the product performs the function, by meaning and whatever the industry; `partly` for a narrower or neighbouring thing, or a function only planned, built to order or a partner's. It answers the same way whether the product is made for the problem, for the use case's industry and for its technologies.
- **The check.** Code looks for each quote in the sources: word for word in the source named, word for word in another source, or with at least six in ten of its telling words there. A finding whose quote is nowhere becomes `not_shown`. Code never raises what the model said.
- **The group.** Direct: every required capability is met. Industry: the industry is met and at least one required capability is shown. Technology: the technology is met with a required capability shown, or half of the required capabilities are met. Otherwise none. A constraint is reported and never decides the group.
- **What is kept** for a candidate: the group, how many required capabilities are met, each finding with its quote, source, reason and where the quote stands, whether the product is made for the problem (for people to read; it decides nothing), the model's one sentence, which of deck and website held no text, and the fingerprint of what was judged. A candidate whose fingerprint is unchanged is not judged again.
- **Steps.** `matching_run_step` keeps, for `requirements`, `candidates` and `judgment`, how many went in and came out, the calls, the tokens and the time. Every call is also recorded in `ai_usage` under the subject `matching_run`.

## What people decide

For the members of the use case's approved organization and for operators; anyone else is told there is no such use case. Every answer is the whole state after the request.

- **Shortlist, remove, restore.** A candidate is undecided, shortlisted or removed: the last decision is its state, and decisions are only added. Removing takes a reason, those of the screen approved on 7 October (`does_not_solve`, `wrong_industry_or_size`, `closed_or_wrong_website`, `duplicate`, `other`), and a note if the person wants; who removed it and when is shown to both sides. It takes the candidate off the shortlist. Restoring puts it back as undecided. What an operator removed, only an operator restores.
- **Add by hand.** An operator adds an approved solution that is not a candidate and is not the organization's own; a run is queued to judge it.
- **No run changes a decision**, and a candidate with a decision stays when a run no longer finds it.
- **What a member does not see:** the steps of a run with their tokens, and the model.
- **Recorded** in the audit log: `matching.run_start`, `matching.candidate_add`, `matching.candidate_shortlist`, `matching.candidate_remove`, `matching.candidate_restore`, `matching.settings_change`.

## Limits

`matching_settings` holds one row, which operators read and change at `/api/matching/admin/settings`; a change made on a version someone else changed is refused.

| Setting | Default | Allowed |
| --- | --- | --- |
| Settle minutes: how long a use case stays unchanged before the run its change asked for starts | 10 | 0 to 1,440 |
| Edit runs per day, for one use case | 3 | 0 to 100 |
| Member runs per day, for one use case | 3 | 0 to 100 |
| Runs per day in all; empty for no limit | 200 | 1 to 100,000 |
| Candidates a run judges | 40 | 5 to 200 |

## HTTP

| Request | Who | Answer |
| --- | --- | --- |
| `GET /api/matching/use-cases/{id}` | Member, operator | The requirements, the last run, the candidates with their findings and decisions |
| `POST /api/matching/use-cases/{id}/runs` | Member, operator | Starts a run; 409 while one works, 429 past a member's limit, 503 without a model |
| `POST /api/matching/use-cases/{id}/candidates` | Operator | Adds a solution by hand |
| `POST /api/matching/candidates/{id}/shortlist`, `/remove`, `/restore` | Member, operator | Records the decision |
| `GET`, `PUT /api/matching/admin/settings` | Operator | The limits |

## Failure and recovery

- **A call is refused or fails:** nothing more is asked in that pass. The run waits `pause` (2 minutes) and continues with the candidates not judged yet. After `max-stalls` (5) passes in a row that judged nothing, it ends as `failed` with the kind of failure.
- **An answer does not fit its shape:** it is asked for once more; a second unreadable answer counts as a failed call.
- **The application stops during a run:** the run is queued again when the worker next wakes, and judges only what is not judged.
- **No model, a use case no longer published, or a brief with no capability:** the run ends as `failed` with `no_model`, `use_case_not_published` or `no_capability`.

## Prompts

`Prompts` holds the wording, version 4. Why it says what it says, the three versions that failed on staging and what was measured are in [the prompt research](../research/2026-10-09-matching-judge-prompts.md). The version is part of every fingerprint, so a new wording reads the requirements and judges every candidate again. Everything the model reads and answers is in English.
