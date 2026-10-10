# Matching: plan

Design: [design.md](design.md). Tracked in Linear as BEY-39. Nothing is coded before Đạt approves this plan.

| # | Step | State |
| --- | --- | --- |
| 1 | The research note, this design and this plan | Done; approved on 9 October |
| 2 | **Source text, in `search`.** The table of passages with its full-text vector and its embedding; the cutting of a page into passages; decks read from the stored files and picture pages by a model; customer cases as passages; the imported websites' text loaded on staging (11,914 passages of 1,897 solutions) | Done (PR #143); the load on production waits for its AI provider |
| 3 | **Requirements.** The model lists a use case's capabilities and constraints from its text and its attached files, each with the passage it comes from; an attachment's pages are read once and kept; prompt version 1 is the probe's, with one function per capability in neutral words | Done; run on staging on 9 October |
| 4 | **Candidates.** A read in `search` that answers the solutions for a set of queries, unlisted included: the search over profiles and the search over passages, each by keywords and by meaning, fused by rank; the 40 first | Done; run on staging on 9 October |
| 5 | **Judgment.** One call per candidate through `AiModels.chat`, typed answer with a retry when it does not fit; the check of each quote and the buckets in plain code, tested with the probe's saved answers | Done; run on staging on 9 October |
| 6 | **The run.** Started when a use case is approved and by an operator; four judgments at a time; waits when the provider's limit is reached; each step's counts, calls, tokens and time stored; a stopped run continues | Done; run on staging on 9 October |
| 7 | **People's decisions.** Shortlist, remove with a reason, restore, add a solution by hand; audited; never changed by a run | Done |
| 8 | The HTTP contract, `openapi.yml`, the web client, `ModulithArchitectureTest`, `ARCHITECTURE.md`, the ADR, `docs/specs/matching.md` and `docs/tests/matching.md` | Done |
| 9 | **Web: the candidates.** The Candidates tab of a use case in the workspace and in Admin › Use cases, as approved in Figma on 7 October: the three buckets, a status per requirement, the reasons with their quotes, the run as it goes, Shortlist, Remove and the Removed tab | Done. Left out, as decided: the Applied strip and the invitations to apply, Introduce us, the History tab, How the AI judged (step 11), and a quote opened in its source (step 10) |
| 10 | **Web: the deck inside BeyondPilot.** Drawn in Figma first and approved; then a view on `react-pdf`, as MemoryOS shows PDFs, opened at the page of a quote | Done on 10 October, asked for by Đạt that day without a Figma screen: a sheet on `react-pdf` 11 that opens at the page of a quote, for a listed solution, with the quote found in the page's text layer and highlighted, the whole page framed and the quote printed when the text does not hold it, Previous and Next page, Open the file, a loading and an error state; the website line as a link to the quoted page (`sourceUrl`, new in the contract), the profile and customer case lines as links to the solution's page; "could not be read" said only of a source the solution has. With it, the row's count line of the approved Figma, the status words Met, Partly met and No evidence, "Key requirement", and the cuts of repeated text. Not delivered: the screen in Figma; zoom, search and thumbnails in the deck; the files PDF.js needs for fonts that are not embedded, JPEG 2000 and JBIG2 pictures and CJK character maps; the deck of an unlisted solution, which stays plain text; a deck page whose quote the check found in another source; Open the file opening in the browser at the page, since the backend sends the deck as a download |
| 11 | **Web: how a run worked, for operators.** The steps of a run as connected nodes with their counts, model, tokens, cost and time. Drawn in Figma first and approved | After step 9 |
| 12 | **A run seen while it works.** The server tells an open page that something changed for a use case (`GET /api/matching/use-cases/{id}/events`, server-sent events); the page reads the state again and shows the stages of the run by name, each solution found as a row that settles into its group when it is read, and what was just added. The reload every five seconds stays for a page whose stream is closed. Design: [live.md](live.md) | Approved by Đạt on 9 October |
| 13 | **People say whether the AI put a solution in the right group** (BEY-106). One question in the panel, Yes or No with the group it belongs in, the requirements the AI judged wrongly and a note; kept by judgment in `matching_feedback`, changing nothing in the list; operators read the agreement and each disagreement on Admin › AI › Matching. Design: [feedback.md](feedback.md) | Approved by Đạt on 10 October |

Steps 2 to 8 are one pull request, steps 9 to 11 another, each made of small commits in this order.

If 16 October is at risk, what goes first is step 11, then step 10 (a quote then links to the deck's download, with its page number), then adding a solution by hand.

## Verification

- `./gradlew :backend:check`. The `matching` tests speak HTTP against PostgreSQL with the model played by the JDK's `HttpServer`, as the `ai` tests do; no test calls a real provider:
  - a run lists requirements, finds candidates, judges them and stores them, and its steps say what they took in and gave out;
  - a quote that is not in the sources lowers its finding, and never raises one; the buckets follow the rule on the probe's saved answers;
  - a candidate with no readable deck says so and is judged on what there is;
  - a run waits out a provider's limit and continues; a stopped run does not judge again what it had judged;
  - a removed candidate is not recommended again, and a rerun keeps the shortlist;
  - only the use case's organization and operators read its candidates; only operators start a run or add a solution;
  - a new deck's pages are extracted after its upload, and replaced when the deck is; a page without text is read by the model and marked so, and stays empty when the model is not chosen or fails.
- `pnpm --dir web check` and the end-to-end tests of the Candidates tab at desktop and mobile widths, with axe.
- On staging: the load of the imported text; then the two use cases of the probe run through the real code with `cx/gpt-6.1-sol`, and their buckets, quotes and cost compared with the probe's; the `ai_usage` rows of the run read.
- When GenAI Fund's longlists arrive: how many of the vendors they name are among the candidates, and in which bucket.

## Needed from outside the code

| What | For | Where it stands |
| --- | --- | --- |
| A read of a solution's customer cases and deck file in `solution`, and of a use case's full text and attached files in `usecase` | Steps 2 to 5 | Small and read-only; added with this work, as Đạt decided on 9 October |
| The text of the imported decks and websites | Step 2 | On a team machine (`BeyondPilot-bey74/.tmp/enrich/full/sources`); never committed |
| The embedding of about 22,000 passages | Step 2 | Through the embedding provider set on staging; about 7 million tokens, about a dollar at the model's list price |
| A model chosen for Matching, and one that reads images for Reading documents, in Admin › AI | Every run; every page without text | Matching is set on staging: `cx/gpt-6.1-sol` through 9Router, which reads images too. Production has no provider and no encryption key yet |
| The calls to read the imported pages without text | Step 2 | About 1,230 pages, or 779 if only the decks that are mostly pictures are read; about 1,200 tokens in per page. Started by an operator, since the route allows about 330 calls an hour |
| GenAI Fund's own longlists | Measuring the buckets | Asked in BEY-41 |
| The screens of the deck view and of the operators' view of a run | Steps 10 and 11 | Not drawn |
