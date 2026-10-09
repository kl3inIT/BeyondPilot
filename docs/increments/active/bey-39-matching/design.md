# Matching: the solutions that fit a use case, with the reasons

Status: approved by Đạt on 9 October 2026; being implemented. Tracked in Linear as BEY-39. What was read and measured before this design is in [Matching: references read and a probe on real use cases](../../../research/2026-10-09-matching-references-and-probe.md).

## What it does

For one use case, BeyondPilot finds the solutions already on it that fit, and says why in a way a person can check: for each thing the use case asks for, whether the solution's own material shows it, with the sentence that shows it and where that sentence is. People then keep, add and remove candidates; what they decide is never undone by the AI.

This is the brief's "early recommendations" and the catalogue half of "formal evaluation" (§7.8). It reads only what BeyondPilot holds: a solution's profile, its customer cases, its deck and the text of its website. It does not search the web (§17).

## Domain story

1. A use case is approved. BeyondPilot starts a **run** for it; an operator can start one again later.
2. The run lists the use case's **requirements** from its text and from the files attached to it: the **capabilities** a product must have, and the **constraints** it would be delivered under (where it runs, what it integrates with, standards, where data is kept, targets). Each names the passage it comes from.
3. The run finds about 40 **candidates**: approved solutions, listed or not, found by the existing search over profiles and by a search over the **passages** of decks and websites, by keywords and by meaning.
4. For each candidate the model reads its **sources** and answers per requirement: met, partly, or not shown, with a **quote** and the source it is in.
5. Code checks each quote against the sources. A quote that is not there lowers its finding to "not shown". Code then places the candidate in a **bucket** (Direct, Industry, Technology, or none) and orders the bucket.
6. The use case's organization and the operators see the candidates appear while the run goes on, each with its findings. A quote from a deck opens the deck at that page.
7. An operator or a member **shortlists** a candidate, **removes** one with a reason, restores one, and an operator **adds** a solution by hand.

Failure and recovery:

- **The model's provider refuses or says its usage limit is reached:** the run stops asking, waits two minutes and continues; candidates already judged are kept. A run that stops five times in a row without judging anything ends as failed with the kind of failure, and can be started again from where it stopped.
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
| Passage | A piece of a solution's material short enough to be searched and embedded: one slide of a deck, a part of a web page of about 2,000 characters, or one customer case. It keeps the page number, the address or the case it comes from |
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
| Load the saved text of imported solutions | An operator, once per environment | Passages for those solutions, kept by `search` | A second load of the same text changes nothing |

Reactions, after commit and idempotent:

- `UseCaseChanged`: when the use case is approved, or its text or its attached files changed since the last run, a run is queued; the run extracts the requirements again first.
- `SolutionChanged`: `search` extracts the deck again when its file changed, and replaces its passages; `matching` hides the candidates of a solution that is no longer approved.

A run is not a transaction. Each step saves what it produced, and each judged candidate is saved when its judgment ends, so a stop loses at most the judgments in flight.

## Data and invariant owner

A new module, `matching`, owns five tables. No other module reads them.

| Table | Holds | Invariant |
| --- | --- | --- |
| `matching_requirement` | The requirements of a use case as last extracted: kind, necessity, statement, quote, and the fingerprint of what they came from: the use case's text, its own list of requirements, which files are attached, and the prompt version | Replaced together when the use case's text or an attached file changes. A requirement whose quote is not in the brief is not kept |
| `matching_run` | A run: use case, state, who started it, the prompt version, the models used, when it started and ended, the kind of failure | At most one running per use case |
| `matching_run_step` | One step of a run: its name and order, how many it took in and gave out, the calls, the tokens and the time | Written by the run only |
| `matching_candidate` | One solution for one use case: its origin, its bucket, how many required capabilities are met, the findings with their quotes and the state of each quote, the model's one-line reason, and the fingerprint of what was judged | Unique per use case and solution |
| `matching_decision` | Each decision on a candidate: shortlisted, removed (reason, note), restored; who and when | Append-only; a candidate's current state is its last decision |

The text of decks and websites is kept by `search`, in one new table, because it is searched and embedded with the index `search` already keeps and must be embedded again when operators change the embedding model:

| Table | Holds | Invariant |
| --- | --- | --- |
| `search_passage` | One passage of a solution's deck, website or customer case: the solution, the source (`deck`, `website` or `customer_case`), the page number or the address, its place on the page, the text, how it was read (`text` or `model`), what it was extracted from, its full-text vector and its embedding with the queue columns `search_document` has | The passages of one source of one solution are replaced together. The public search never reads this table |

A deck's passages can be made again from its file. The website passages of imported solutions are loaded once and cannot be made again until BEY-99 reads websites, so the nightly rebuild of the index leaves passages alone.

The use case's own `use_case_requirement` rows stay with `usecase`. Where an organization wrote them, matching starts from them; it never writes them.

## Context map

`matching` is a closed Spring Modulith module. It depends on `ai`, `search`, `solution`, `usecase`, `organization`, `identity` and `audit`; nothing depends on it. `search` gains no new dependency: it already depends on `ai` and `solution`.

| Needs | From | How |
| --- | --- | --- |
| A chat client for a task, every call recorded | `ai` | `AiModels.chat(task, subject)`; the subject is the run |
| The solutions that match a set of queries, unlisted included, from profiles and from passages, up to a limit | `search` | A new read beside `findForOperators` |
| The passages of a solution, to give the model and to check quotes against | `search` | A new read |
| An approved solution's profile | `solution` | `SolutionDirectory.indexed(id)`, as search reads it |
| A solution's customer cases | `solution` | **A new read in `solution`'s published API** |
| A solution's deck file, for `search` to extract its pages | `solution` | **A new read in `solution`'s published API**, used by `search` |
| A use case's full text, problem statement included, and its attached files | `usecase` | **A new read in `usecase`'s published API**: `indexed` leaves the problem statement out on purpose |
| The pages of a file: its own text, or a model's reading of a page without text | `ai` | A new service in `ai`, used by `search` and `matching` |
| Who belongs to the use case's organization | `organization` | `Membership` |
| The record of a decision | `audit` | `AuditTrail` |

The new reads are in modules Việt and Nhật own. They are small and read-only, and Đạt decided on 9 October that they are added with this work.

HTTP, under `/api/matching`: the candidates of a use case with its run and requirements (members of its organization and operators); start a run and add a solution (operators); shortlist, remove, restore; the steps of a run (operators).

## Decisions

| Decision | Why |
| --- | --- |
| Requirements in two kinds, capability and constraint; a capability is one function in neutral words | The probe: with targets, hardware and standards among the required items nobody reached Direct; with compound or industry-bound capabilities the right vendors were only "partly" |
| Candidates from the existing search over profiles joined with a search over the passages of decks and websites, fused by rank; about 40 are judged | The probe: for a general business need the best candidates were not among the 100 nearest to the brief, and the document text found them. Seven in ten judgments of a wider pool were wasted |
| The text of decks and websites is kept as passages in `search`, as plain text exactly as extracted; no model cleans or rewrites it | A quote must be the vendor's own words, and code checks it against this text. `pdftotext` made the 734 deck texts that exist, and the model quoted from them word for word. `search` keeps them because it owns the index, the embedding queue and the rule that a new embedding model embeds everything again |
| Passages are searched by keywords and by meaning, with the embedding model `search` already uses, and fused by rank with the search over profiles | Corrected on 9 October after Đạt asked why nothing was embedded. The probe found the missing candidates with a keyword search fed by queries the model wrote; with the requirements themselves as the query, keywords alone would miss a vendor who says the same thing in other words. Meaning covers that without a model call per run, the index is already hybrid for the same reason, and embedding all passages costs about a dollar. Not measured yet: the probe had no embedding key |
| A slide is one passage; a web page is cut into passages of about 2,000 characters at line ends | A slide has a median of 550 characters. A web page has a median of 3,300 and up to 130,000, too long for one vector to mean one thing |
| The model judges one candidate per call and answers per requirement with a quote and its source, the quote before the status | candisift, fire-enrich, Exa Websets: evidence first, and nothing to hide behind a score |
| Code decides the bucket and the order; it only lowers what the model said | candisift's guard. The hand method's rules are short enough to be code, and code can be tested and changed in one place |
| Direct: every required capability is met. Industry: a similar workflow delivered in the use case's industry and at least one capability shown. Technology: the named technology or a capability met. Inside a bucket, more capabilities met comes first | The hand method ("an unverified essential capability disqualifies Direct"; "an empty Direct is acceptable"). This is the first version of the rule: it is confirmed or changed when GenAI Fund's own longlists arrive (BEY-41) |
| One task and one model for every step of a run | Only one model is to be used. The model's quotes were all real in the probe, so a second model has nothing proven to add |
| A run waits when a call is refused, whatever the provider says, for a fixed two minutes | The probe met the limit of the 9Router route after about 330 calls, and calls went through again two minutes later. Providers name the wait in different ways, and a module that read each one's answer would depend on each provider |
| A run is a row that a worker takes, one run at a time | Started by an approval, by an operator or after a restart, it is the same row; a stopped application leaves nothing half done that the next start does not take up |
| The text of an attached file is read when the requirements are extracted and is not kept | It is needed once, to extract and to check the quotes. The fingerprint names the files, so a brief that did not change reads no file again |
| An answer that does not fit its shape is asked for once more by matching's own code, not by Spring AI's `StructuredOutputValidationAdvisor` | The advisor repeats the call below the advisor that records usage, so a repeated call would cost tokens that no record shows |
| What a person decided is outside what a run may change | candisift; the old platform could neither add nor remove a match (kickoff) |
| The website text of imported solutions comes by a one-off load, the way BEY-74 loaded records: a script writes SQL, run on staging then production | That text exists only on a team machine until BEY-99 reads websites; the records are written once |
| A deck's text is read by the application from the stored file, in the background, a few decks a minute, with PDFBox | No model is needed for a page that has text: `pdftotext` made the deck texts the probe used. PDFBox is what Spring AI's own PDF reader and MemoryOS's built-in reader are made of, and it also draws the picture of a page, which reading a page without text needs. The imported decks are read the same way as new ones, from the 735 files already stored, so no deck text is loaded from a team machine |
| A page of a deck that has no text is read by a model from its picture, in the same background work, and marked `model` | Decided by Đạt on 9 October. 61 of the 734 imported decks have no text on at least half their pages (779 pages), and 451 more such pages are spread over the other decks. The 9Router route was checked: `cx/gpt-6.1-sol` copied the text of a picture sent as Spring AI sends one. MemoryOS reads scans with a vision model too |
| A customer case is a passage too | The 1,046 customer cases are text in the database, with a median of 170 characters, and they are what shows a deployment in an industry; the index counts them today and does not search what they say |
| The files attached to a use case are read for its requirements, and are not embedded | 35 of the 230 use cases have one: 30 PDFs and 5 pictures. They are part of what the enterprise asks, the side that is searched with, not the side that is searched in |
| Reading a file page by page, with a model for a page without text, is one service in `ai` | Two modules need it: `search` for decks, `matching` for a use case's attachments. `ai` already keeps the task and its model |
| Reading pictures is its own task in Admin › AI ("Reading documents"), which takes only a model that reads images | Its cost is recorded apart from matching runs, it needs no reasoning, and the same model can be chosen for both. Proposed; to confirm |
| A quote from a page a model read is shown as such | The words are the model's copy of the slide, not the file's own text; code still checks the quote against that copy |
| A deck opens inside BeyondPilot at the page of a quote, on `react-pdf` as MemoryOS shows PDFs | Asked for by Đạt as a needed feature; the browser's own viewer does not open at a page on phones |
| The steps of each run are stored with their counts, calls, tokens and time | The operators' view of how a run worked reads them; it is drawn after the list |
| Everything the model reads and answers is in English | Decided on 9 October; all 230 use cases are in English |

## Left out

- **Reading a picture attached to a use case** (5 of the 35 attachments): only PDFs are read for the requirements, their picture pages included.
- **Reading the website of a newly registered solution** (BEY-99, through Firecrawl as MemoryOS does). Until then a new solution is judged on its profile, customer cases and deck.
- **Judging the proposals a provider sent** against the use case. Proposals belong to programs today.
- **Queries written by the model** and a **second model that checks the first**: each waits for a measure that shows the need.
- **Research on the open web**, outreach, and the operators' MCP tools for candidates (BEY-78).
- **A score.**

## Open

- GenAI Fund's own longlists, to measure the buckets against (BEY-41).
- Whether a required capability that is only partly shown may still count for Direct (BEY-41, with the longlists).
- Whether a member of the use case's organization may start a run again, or only operators. Proposed: operators only, to keep the cost in one place.
- The screens: the candidate list is approved (7 October). The deck view and the operators' view of a run are not drawn yet and need approval before they are coded.

## References read

[Matching: references read and a probe on real use cases](../../../research/2026-10-09-matching-references-and-probe.md), [Spring AI references](../../../research/2026-10-05-spring-ai-references.md), [search references](../../../research/2026-10-06-search-references.md), and [GenAI Fund's method](../../../research/sources/use-case-solution-research.md).
