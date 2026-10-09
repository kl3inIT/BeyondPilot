# Matching

For one published use case, the solutions on BeyondPilot that fit it, each with the reasons a person can check, and what people then decide on them. Designed in [BEY-39](../increments/active/bey-39-matching/design.md) and decided in [ADR 0007](../decisions/0007-a-matching-module-that-reads-through-search.md). This page says what exists.

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
- **Stage.** A running run says what it is doing, `brief`, `search` or `reading`, from the steps it has kept: a step is kept when it ends, so the run is at the first one it has not kept. A run that continues after a wait has kept them all and says `reading` from the start.

## Changes told to an open page

Designed in [a run seen while it works](../increments/active/bey-39-matching/live.md).

- **The stream.** `GET /api/matching/use-cases/{id}/events` is a stream of server-sent events from Spring MVC, for whoever may read the use case's matching; the right is checked once, when the stream opens. It answers with `Cache-Control: no-store` and `X-Accel-Buffering: no`, sends a comment line when it opens and every 20 seconds, and has no end of its own.
- **An event says that something changed, not what the state is.** Its name is the kind of change and its body is `{}`; the page reads `GET /api/matching/use-cases/{id}` again. Nothing is replayed: every change is in the database when it is told, so a page that lost its stream reads the state once when the stream is back.

  | Event | Told when |
  | --- | --- |
  | `run` | A run is queued, has its start moved or brought forward, is taken by the worker, has to wait, ends or fails |
  | `brief` | The requirements are read |
  | `found` | The candidates are found and kept |
  | `reading` | The judgment of one solution starts; the body is `{"solutionId": "…"}` |
  | `read` | The judgment of one solution ended: it was kept, was not needed because nothing changed, or failed; the body is `{"solutionId": "…"}` |
  | `decision` | A person shortlisted, removed or restored a candidate, or an operator added one by hand |

- **Which solutions are being read now is not stored**; `reading` and `read` are the only place it is said, which is why they carry the solution.
- **One sink inside the application** (`MatchingChanges`), which the stream of each use case filters. A change made in a transaction is told after the commit, and not at all when the transaction is rolled back. Telling never waits for a listener: each has a buffer of 256 changes and loses the oldest past that, and a run tells into an empty room at no cost. The backend is one instance; with a second, a page on the other instance would hear nothing and stay current by the reload below.
- **Spring Security** lets the async dispatch that ends a stream through without asking for the session again: only the application starts one, for a request the chain already let in.

## What people decide

For the members of the use case's approved organization and for operators; anyone else is told there is no such use case. Every answer is the whole state after the request.

- **Shortlist, remove, restore.** A candidate is undecided, shortlisted or removed: the last decision is its state, and decisions are only added. Removing takes a reason, those of the screen approved on 7 October (`does_not_solve`, `wrong_industry_or_size`, `closed_or_wrong_website`, `duplicate`, `other`), and a note if the person wants; who removed it and when is shown to both sides. It takes the candidate off the shortlist. Restoring puts it back as undecided. What an operator removed, only an operator restores.
- **Add by hand.** An operator adds an approved solution that is not a candidate and is not the organization's own; a run is queued to judge it.
- **No run changes a decision**, and a candidate with a decision stays when a run no longer finds it.
- **What a member does not see:** the steps of a run with their tokens, the model, which operator removed a candidate (only that GenAI Fund did), and the kind of failure of a run when it happened at the AI provider (they read `provider`). A candidate that is not the caller's reads as one that does not exist.
- **Recorded** in the audit log: `matching.run_start`, `matching.candidate_add`, `matching.candidate_shortlist`, `matching.candidate_remove`, `matching.candidate_restore`, `matching.settings_change`.

## Screens

One page, Matched solutions, beside the brief of a published use case: for the members of its organization at `/workspace/organization/use-cases/{id}/candidates`, for operators at `/admin/use-cases/{id}/candidates`. A row of two tabs, Brief and Matched solutions, links the two pages. Both sides read the same page, in the same words, written for a member of an innovation team who is not an AI specialist; the answer of `GET /api/matching/use-cases/{id}` says what the caller may do.

- **Words.** The page says "solution", never "candidate". A requirement is "what you asked for"; a finding is Shown, Partly shown or No evidence found; a required capability is tagged Must have. The groups Direct, Industry and Technology are named Strong fit, Experience in your industry, and Right technology, less proof.
- **The run.** A run that is queued says so, and when it starts if it waits for the brief to stay unchanged; a run that waits says how many solutions are read and that it continues by itself; a failed run says why by its code. Without a model the page says it cannot look for solutions, and sends operators to Admin › AI. A finished run reads "Updated" with its date; operators also read how many solutions the AI read and the model.
- **A run at work.** The page keeps the stream of changes open for as long as it is open, during a run or not, and reads the state again when a change arrives, once for the changes that arrive within 150 ms. While a run is running it shows:
  - **the stages by name**, as an ordered list: Reading your brief, Searching the solutions, Reading each solution with "16 of 40" and a bar, Done. The stages behind are ticked, the one at work is the current step. A page that watched a run to its end keeps the stages, all ticked, above "Updated";
  - **every solution found as a row at once**: what is not read yet stands in a group named Being read (the face of Not reviewed yet while a run works or waits for the AI service), each row saying Reading now or Waiting. A row the AI reads again says Reading now in its own group. When a solution is read its row enters its group, fading in over 200 ms with a highlight that fades in two seconds; one that fits no group leaves the list. Nothing moves for a reader who asked for reduced motion;
  - **a line of what just happened** under the stages, a polite live region: "Added fileAI to Strong fit", or "3 more read, 1 added" when several were read together. A solution that fits no group is not spoken of;
  - **the last group open with every row**, so that rows are seen arriving, until the person closes it. It stays so after a run the page watched; a page opened later finds it folded.
- **Without the stream.** While the stream is not open, before it opens or when a proxy refuses it, and a run is queued, running or waiting, the page reads itself again every five seconds, as it did before the stream. A stream the browser gave up on is asked for again after 5 seconds, then at growing intervals up to a minute.
- **Head actions.** One visible action, Look for new solutions (Find solutions before the first run). A member reads how many runs the day still allows and is asked to confirm, in a dialog that says the run uses one of them; an operator is not asked. Operators have a More menu with Add one by hand, a search over the approved solutions, and Re-review every solution, behind a confirmation.
- **The top of the list.** A use case that asks for one capability, as most do, reads one sentence, how many solutions match and how many do exactly what was asked for, with the capability's statement in full under it ("You asked for: …"). A use case that asks for two or more reads how many of them the solutions cover together, one line for each that no solution shows, and a chip for each that narrows the list to the solutions that show it or part of it; the first chip, Any, clears the filter. Neither case draws a bar. One line under it says the AI read each vendor's public material and that the reader should check.
- **Tabs.** Matches, Shortlist and Removed, each with its count.
- **The list.** Each group is a named region under a second-level heading, with its count and what it means printed under the title. Strong fit and Experience in your industry show every row. Right technology, less proof shows its header alone until it is opened, then five rows and Show more; it does not fold when it is the only group with rows, or on the Shortlist tab. Not reviewed yet holds what an operator added, and On your shortlist, no longer suggested holds what a person keeps although the last run put it in no group. A solution the AI put in no group is not shown and not counted.
- **A row** has the logo, the name and the shortlist action on one line at every width (the action is an icon on a phone); then, only when the use case asks for one capability and the group does not say it already, whether it is shown, and a short note when the deck or the website could not be read; then the AI's sentence in two lines at most; then country and maturity. It has no quote and no source.
- **One solution** is read beside the list from 1280px, and in a sheet below that. Top to bottom: the name, country and maturity and a link to the solution's profile; the group and the AI's sentence, captioned AI summary, with the note on an unread deck or website; each capability with its statement in full, Must have where it is required, the verdict as an icon and words, the AI's reason, and the vendor's words as a quotation with where they come from under it ("From their website", "From their deck, page 6"); the constraints behind a disclosure that says how many there are, under Ask the vendor about these; then Add to shortlist and Not a fit.
- **Decisions.** Add to shortlist on a row or in the panel, and again to take it off. Not a fit opens the reasons in the place of the row, with a note that is optional whatever the reason, and the toast offers Undo. The Removed tab spans the whole width, with no panel: it says who removed a solution (GenAI Fund for an operator), why and when, with Restore; a member reads why what GenAI Fund removed cannot be restored.
- **Touch.** On a touch screen the chips, the tabs, the menu items and the sheet's close button are at least 44px tall.

Not on the screen: the proposals received and the invitation to apply, Introduce us, the history of runs, how the AI judged, a run's steps, a quote opened in its source, selecting several solutions at once and sorting. The AI's sentences and the vendors' words stay in English on the Vietnamese page.

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
| `GET /api/matching/use-cases/{id}/events` | Member, operator | The stream of changes, as server-sent events; 404 for anyone else |
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
