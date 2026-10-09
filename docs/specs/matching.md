# Matching

For one published use case, the solutions on BeyondPilot that fit it, each with the reasons a person can check. Designed in [BEY-39](../increments/active/bey-39-matching/design.md) and decided in [ADR 0007](../decisions/0007-a-matching-module-that-reads-through-search.md). This page says what exists; the HTTP contract, people's decisions and the screens are not built yet.

## Module

- **`matching` is a closed module** that depends on `ai`, `search`, `solution` and `usecase`. Nothing depends on it. It has no HTTP contract yet.
- **It owns** `matching_requirement`, `matching_run`, `matching_run_step`, `matching_candidate` and `matching_decision` (V60). `matching_decision` is written by nothing yet.
- **It reads** a use case's whole brief with its attached files (`UseCaseDirectory.brief`), a solution's profile (`SolutionDirectory.indexed`), the solutions that answer a set of queries and the passages of one solution (`SolutionEvidence` in `search`), and a chat client for the task `matching` (`AiModels.chat`).

## A run

A run is a row of `matching_run` that a worker takes, one run at a time, every `beyondpilot.matching.interval` (10 seconds).

- **Queued** when a use case is published or changed (`UseCaseChanged`), if a model is chosen for the task and the brief is not the one its requirements were last read from. A use case has at most one run that has not ended.
- **Requirements.** One call lists what the brief asks for: capabilities (what the product does) and constraints (the conditions of delivery), each required or optional, each with the words of the brief it comes from. The brief is the use case's text, the requirements its organization listed, and the text of its attached PDFs (40 pages a file, 40,000 characters in all; a page that is only a picture is read by the model of the task `document_reading` when one is chosen). A requirement of an unknown kind, or whose quote is not in the brief, is not kept. They are kept with the fingerprint of the brief, and a brief that did not change asks nothing.
- **Candidates.** The title and each capability are a query. `search` answers each by its words and by its meaning, over the solutions' profiles and over the passages of their decks, websites and customer cases, and the queries are fused by adding their scores. The first `candidates` (40) are kept, unlisted solutions included. A candidate a later run no longer finds is taken out, unless a person decided on it.
- **Judgment.** One call a candidate, `parallel` (4) at a time. The model reads the requirements and the solution's sources under their labels (`profile`, `customer case 1`, `deck p.3`, `website 2`; a deck to 30,000 characters, a website to 24,000 and 8,000 a page) and answers for each requirement `met`, `partly` or `not_shown` with a quote and its source, and the same for the use case's industry and its technologies.
- **The check.** Code looks for each quote in the sources: word for word in the source named, word for word in another source, or with at least six in ten of its telling words there. A finding whose quote is nowhere becomes `not_shown`. Code never raises what the model said.
- **The group.** Direct: every required capability is met. Industry: the industry is met and at least one required capability is shown. Technology: the technology is met with a required capability shown, or half of the required capabilities are met. Otherwise none. A constraint is reported and never decides the group.
- **What is kept** for a candidate: the group, how many required capabilities are met, each finding with its quote, source and where the quote stands, the model's one sentence, which of deck and website held no text, and the fingerprint of what was judged. A candidate whose fingerprint is unchanged is not judged again.
- **Steps.** `matching_run_step` keeps, for `requirements`, `candidates` and `judgment`, how many went in and came out, the calls, the tokens and the time. Every call is also recorded in `ai_usage` under the subject `matching_run`.

## Failure and recovery

- **A call is refused or fails:** nothing more is asked in that pass. The run waits `pause` (2 minutes) and continues with the candidates not judged yet. After `max-stalls` (5) passes in a row that judged nothing, it ends as `failed` with the kind of failure.
- **An answer does not fit its shape:** it is asked for once more; a second unreadable answer counts as a failed call.
- **The application stops during a run:** the run is queued again when the worker next wakes, and judges only what is not judged.
- **No model, a use case no longer published, or a brief with no capability:** the run ends as `failed` with `no_model`, `use_case_not_published` or `no_capability`.

## Prompts

`Prompts` holds the wording, version 1, measured on two real use cases on 9 October 2026 ([research](../research/2026-10-09-matching-references-and-probe.md)). The version is part of every fingerprint, so a new wording reads the requirements and judges every candidate again. Everything the model reads and answers is in English.
