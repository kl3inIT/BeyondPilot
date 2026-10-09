# Matching: the solutions that fit a use case, with the reasons

Status: proposed on 9 October 2026, waiting for Đạt's approval. Tracked in Linear as BEY-39. What was read and measured before this design is in [Matching: references read and a probe on real use cases](../../../research/2026-10-09-matching-references-and-probe.md).

## What it does

For one use case, BeyondPilot finds the solutions already on it that fit, and says why in a way a person can check: for each thing the use case asks for, whether the solution's own material shows it, with the sentence that shows it and where that sentence is. People then keep, add and remove candidates; what they decide is never undone by the AI.

This is the brief's "early recommendations" and the catalogue half of "formal evaluation" (§7.8). It reads only what BeyondPilot holds: a solution's profile, its customer cases, its deck and the text of its website. It does not search the web (§17).

## Domain story

1. A use case is approved. BeyondPilot starts a **run** for it; an operator can start one again later.
2. The run lists the use case's **requirements** from its text: the **capabilities** a product must have, and the **constraints** it would be delivered under (where it runs, what it integrates with, standards, where data is kept, targets). Each names the passage of the brief it comes from.
3. The run finds about 40 **candidates**: approved solutions, listed or not, found by the existing search and by a keyword search over the text of decks and websites.
4. For each candidate the model reads its **sources** and answers per requirement: met, partly, or not shown, with a **quote** and the source it is in.
5. Code checks each quote against the sources. A quote that is not there lowers its finding to "not shown". Code then places the candidate in a **bucket** (Direct, Industry, Technology, or none) and orders the bucket.
6. The use case's organization and the operators see the candidates appear while the run goes on, each with its findings. A quote from a deck opens the deck at that page.
7. An operator or a member **shortlists** a candidate, **removes** one with a reason, restores one, and an operator **adds** a solution by hand.

Failure and recovery:

- **The model's provider refuses or says its usage limit is reached:** the run waits for the time the provider names and continues; candidates already judged are kept. A run that cannot continue ends as failed with the kind of failure, and can be started again from where it stopped.
- **No model is chosen for matching:** no run starts; the screen says so to operators.
- **A page of a deck has no text, only a picture:** a model reads the page from its picture, and the page is marked as read that way. A page nothing could read stays empty and is counted.
- **A solution has no readable deck or website text at all:** it is judged on its profile and customer cases, and the candidate says which source could not be read. It is never reported as "not shown" for lack of text alone.
- **Nothing fits:** the buckets are empty and the screen says which capability nobody shows. An empty Direct bucket is a result, not an error.
- **The use case or a solution changes after a run:** the next run judges again only what changed.

## Glossary

| Term | Meaning |
| --- | --- |
| Run | One pass of matching for one use case, with its steps, their counts and what they cost |
| Requirement | One thing the use case asks for, taken from its text with the passage it comes from. Either a capability or a constraint; required or optional |
| Capability | One function the product itself performs, in words that fit any industry |
| Constraint | A condition on how the solution is delivered or bought. Shown as "to confirm"; it never decides the bucket |
| Source | A part of a solution's own material: its profile, a customer case, a page of its deck, a page of its website |
| Source page | The text of one page of a deck or of a website, with its page number or address, and how it was read: taken from the file's own text, or read by a model from the picture of the page |
| Candidate | One solution for one use case, with how it got there (recommended, or added by an operator) |
| Finding | The answer for one requirement of one candidate: met, partly or not shown, with a quote and its source |
| Quote | A sentence copied word for word from a source. Code confirms it is there |
| Bucket | GenAI Fund's three groups, strongest first: Direct, Industry, Technology. A candidate is in one bucket or in none |
| Decision | What a person did with a candidate: shortlisted, removed with a reason, restored |

A **candidate** is not an **applicant**. A proposal a provider sent goes through review (BEY-38) and is not judged here.

## Commands, facts and consistency

| Command | Who | Fact | Consistency |
| --- | --- | --- | --- |
| Start a run | The system when a use case is approved; an operator | A run exists for the use case | One run per use case at a time; a second start while one runs is refused |
| Add a solution by hand | An operator | A candidate with the source "added by GenAI Fund" | An approved solution not already a candidate |
| Shortlist, remove with a reason, restore | An operator; a member of the use case's organization (restore only what they removed) | A decision, recorded with who and when; audited | A removed candidate leaves the shortlist |
| Load the saved text of imported solutions | An operator, once per environment | Source pages for those solutions | A second load of the same text changes nothing |

Reactions, after commit and idempotent:

- `UseCaseChanged`: when the use case is approved, or its text changed since the last run, a run is queued.
- `SolutionChanged`: when the deck file changed, its pages are extracted again; when the solution is no longer approved, its candidates are hidden.

A run is not a transaction. Each step saves what it produced, and each judged candidate is saved when its judgment ends, so a stop loses at most the judgments in flight.

## Data and invariant owner

A new module, `matching`, owns six tables. No other module reads them.

| Table | Holds | Invariant |
| --- | --- | --- |
| `matching_source_page` | One page of a solution's deck or website: the solution, the source (`deck` or `website`), the page number or the address, the text, how it was read (`text` or `model`), when it was extracted and what it was extracted from; a full-text index over the text | The pages of one source of one solution are replaced together |
| `matching_requirement` | The requirements of a use case as last extracted: kind, necessity, statement, quote, and the hash of the text they came from | Replaced together when the use case's text changes |
| `matching_run` | A run: use case, state, who started it, the prompt version, the models used, when it started and ended, the kind of failure | At most one running per use case |
| `matching_run_step` | One step of a run: its name and order, how many it took in and gave out, the calls, the tokens and the time | Written by the run only |
| `matching_candidate` | One solution for one use case: its origin, its bucket, how many required capabilities are met, the findings with their quotes and the state of each quote, the model's one-line reason, and the fingerprint of what was judged | Unique per use case and solution |
| `matching_decision` | Each decision on a candidate: shortlisted, removed (reason, note), restored; who and when | Append-only; a candidate's current state is its last decision |

The use case's own `use_case_requirement` rows stay with `usecase`. Where an organization wrote them, matching starts from them; it never writes them.

## Context map

`matching` is a closed Spring Modulith module. It depends on `ai`, `search`, `solution`, `usecase`, `organization`, `storage`, `identity` and `audit`; nothing depends on it.

| Needs | From | How |
| --- | --- | --- |
| A chat client for a task, every call recorded | `ai` | `AiModels.chat(task, subject)`; the subject is the run |
| Solutions that match a query, unlisted included, more than one page | `search` | A new read beside `findForOperators`, answering identifiers up to a limit |
| An approved solution's profile | `solution` | `SolutionDirectory.indexed(id)`, as search reads it |
| A solution's customer cases and its deck file | `solution` | **New reads in `solution`'s published API** |
| A use case's full text, problem statement included | `usecase` | **A new read in `usecase`'s published API**: `indexed` leaves the problem statement out on purpose |
| Who belongs to the use case's organization | `organization` | `Membership` |
| The bytes of a deck | `storage` | Through the read `solution` publishes |
| The record of a decision | `audit` | `AuditTrail` |

The two new reads are in modules Việt and Nhật own; they are small and read-only, and are agreed with them before they are written.

HTTP, under `/api/matching`: the candidates of a use case with its run and requirements (members of its organization and operators); start a run and add a solution (operators); shortlist, remove, restore; the steps of a run (operators).

## Decisions

| Decision | Why |
| --- | --- |
| Requirements in two kinds, capability and constraint; a capability is one function in neutral words | The probe: with targets, hardware and standards among the required items nobody reached Direct; with compound or industry-bound capabilities the right vendors were only "partly" |
| Candidates from the existing search joined with a keyword search over deck and website text, fused by rank; about 40 are judged | The probe: for a general business need the best candidates were not among the 100 nearest to the brief, and the document text found them. Seven in ten judgments of a wider pool were wasted |
| The text of decks and websites is kept page by page in `matching`, as plain text exactly as extracted; no model cleans or rewrites it | A quote must be the vendor's own words, and code checks it against this text. `pdftotext` made the 734 deck texts that exist, and the model quoted from them word for word |
| That text is searched by keywords in Postgres; it is not embedded yet | What the probe measured is a keyword search. Embedding it means chunks, a vector column and a queue; it is added if a measure shows keywords miss |
| The model judges one candidate per call and answers per requirement with a quote and its source, the quote before the status | candisift, fire-enrich, Exa Websets: evidence first, and nothing to hide behind a score |
| Code decides the bucket and the order; it only lowers what the model said | candisift's guard. The hand method's rules are short enough to be code, and code can be tested and changed in one place |
| Direct: every required capability is met. Industry: a similar workflow delivered in the use case's industry and at least one capability shown. Technology: the named technology or a capability met. Inside a bucket, more capabilities met comes first | The hand method ("an unverified essential capability disqualifies Direct"; "an empty Direct is acceptable"). This is the first version of the rule: it is confirmed or changed when GenAI Fund's own longlists arrive (BEY-41) |
| One task and one model for every step of a run | Only one model is to be used. The model's quotes were all real in the probe, so a second model has nothing proven to add |
| A run waits when the provider says its limit is reached | The probe met the limit of the 9Router route after about 330 calls |
| What a person decided is outside what a run may change | candisift; the old platform could neither add nor remove a match (kickoff) |
| Imported solutions get their text by a one-off load, the way BEY-74 loaded records: a script writes SQL, run on staging then production | The text exists on a team machine; the records are written once |
| A new deck's text is extracted after the upload, in the background, with Spring AI's PDF reader | No model is needed for a page that has text: `pdftotext` made the deck texts that exist |
| A page of a deck that has no text is read by a model from its picture, in the same background work, and marked `model` | Decided by Đạt on 9 October. 61 of the 734 imported decks have no text on at least half their pages (779 pages), and 451 more such pages are spread over the other decks. The 9Router route was checked: `cx/gpt-6.1-sol` copied the text of a picture sent as Spring AI sends one. MemoryOS reads scans with a vision model too |
| Reading pictures is its own task in Admin › AI ("Reading documents"), which takes only a model that reads images | Its cost is recorded apart from matching runs, it needs no reasoning, and the same model can be chosen for both. Proposed; to confirm |
| A quote from a page a model read is shown as such | The words are the model's copy of the slide, not the file's own text; code still checks the quote against that copy |
| A deck opens inside BeyondPilot at the page of a quote, on `react-pdf` as MemoryOS shows PDFs | Asked for by Đạt as a needed feature; the browser's own viewer does not open at a page on phones |
| The steps of each run are stored with their counts, calls, tokens and time | The operators' view of how a run worked reads them; it is drawn after the list |
| Everything the model reads and answers is in English | Decided on 9 October; all 230 use cases are in English |

## Left out

- **Reading the website of a newly registered solution** (BEY-99, through Firecrawl as MemoryOS does). Until then a new solution is judged on its profile, customer cases and deck.
- **Judging the proposals a provider sent** against the use case. Proposals belong to programs today.
- **Queries written by the model**, a **second model that checks the first**, and **embeddings of the document text**: each waits for a measure that shows the need.
- **Research on the open web**, outreach, and the operators' MCP tools for candidates (BEY-78).
- **A score.**

## Open

- GenAI Fund's own longlists, to measure the buckets against (BEY-41).
- Whether a required capability that is only partly shown may still count for Direct (BEY-41, with the longlists).
- Whether a member of the use case's organization may start a run again, or only operators. Proposed: operators only, to keep the cost in one place.
- The screens: the candidate list is approved (7 October). The deck view and the operators' view of a run are not drawn yet and need approval before they are coded.

## References read

[Matching: references read and a probe on real use cases](../../../research/2026-10-09-matching-references-and-probe.md), [Spring AI references](../../../research/2026-10-05-spring-ai-references.md), [search references](../../../research/2026-10-06-search-references.md), and [GenAI Fund's method](../../../research/sources/use-case-solution-research.md).
