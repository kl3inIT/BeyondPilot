# Formal evaluation: the proposals a use case received, set against its requirements

Status: approved by Đạt on 20 October 2026; being implemented. Tracked in Linear as BEY-229. No Figma frame: Đạt waived it for this issue, and the screens follow the received proposals page (BEY-133) and the evidence of Matched solutions (BEY-39).

## Why

The brief's §7.8 asks for **formal evaluation**: "Assist comparison of applicable solutions and received proposals against a use case", with Phase 1 depth to agree. Matching delivered the first half: the solutions on BeyondPilot that fit a use case, each requirement judged with a quote code has checked. The second half was missing. An organization that posts a use case reads the proposals it received one at a time (BEY-133) and has nothing that sets them side by side.

We define the depth ourselves: the same evidence matching gives a solution, given for each proposal received, and a table that compares them. The AI gives no score, no rank and no recommendation; the decision stays the organization's, through Shortlist and Decline.

## What people can do

Tasco posts "AI that reads claim files, runs on Tasco's servers, connects to SAP" and receives proposals from A, B and C.

- **Compare.** On the received proposals page, for the organization at `/workspace/organization/use-cases/{id}/proposals` and for operators at `/admin/use-cases/{id}/proposals`, a switch beside the tabs offers **List** and **Compare**. Compare is a table: a row for each requirement of the use case, capabilities first with Must have on the required ones, then the constraints; a column for each proposal of the tab chosen (All, Shortlisted, Declined), named by its organization. A cell is Met, Partly met or No evidence, with its icon. The address keeps the choice (`?view=compare`).
- **Check why.** A cell opens a popover with the vendor's words as a quotation, where they come from, and the AI's reason in one sentence. A quote from a web page links to that page.
- **Read one proposal.** The proposal's page gains a card, **How it meets your requirements**, under the decision: the AI's one sentence, then each requirement with its statement, Must have where required, the status, the reason and the quote with its source.
- **See that the AI is at work.** A proposal not read yet says so in its column and its card ("AI reads this proposal in a few minutes"). One read before the proposal was edited is shown with a line saying it was read before the last edit.

What a reader is never told: the model, the tokens, the cost. They stay on Admin › AI › Matching › Runs, where an operator reads them as for any run.

## Domain story

1. A provider **sends** a proposal to a use case, or **edits** one it sent. The proposal module publishes `UseCaseProposalSent`.
2. Matching hears it and **queues a run** of the use case, as an edit of the brief does: it waits `settle minutes` after the last change, and another change moves that moment.
3. The run does what a run does: it reads the requirements, finds and judges the candidates (a candidate whose material is unchanged asks nothing). Then it **judges each proposal** the use case holds now, sent and not withdrawn.
4. For a proposal the model reads, under their labels: the proposal's approach (`proposal`), its team (`team`), each page of its PDF (`proposal deck p.3`), and for each solution it offers, in the proposal's order, that solution's profile, customer cases, deck pages and web pages (`solution 1 profile`, `solution 1 deck p.2`, `solution 1 website 3`). It answers per requirement as for a candidate.
5. Code checks every quote against those texts, as for a candidate, and keeps the proposal's **evaluation** with what was read. A proposal whose material and requirements did not change is not asked again.
6. The organization and operators read the evaluations on the proposals pages.

Failure and recovery are a run's: a refusal waits and goes on, a run that keeps failing ends as failed, and an operator can start one again from the Matched solutions page.

## What the brief asks vendors to explain

| Case                                         | What happens                                                                                                                                                                                                           |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A document cannot be read                    | A proposal PDF with no text is read from the pictures of its pages by the model chosen for reading documents, as a use case's attachment is. One that still gives no text is named: "The proposal's PDF could not be read", and the rest is judged. Nothing turns silently into "No evidence". |
| Documents change                             | An edit queues a run. Until it ends, the evaluation kept says it was made before the last edit. A brief that changes is read again, and every proposal is judged against the new requirements.                       |
| One provider offers several solutions        | The proposal is judged as one offer: every solution it names is read, and each quote says which solution it comes from ("Solution 2 · Deck, p. 4").                                                                     |
| The reasons for what the AI says             | The quote, its source and the AI's sentence. A quote that is in none of the texts lowers its finding to No evidence; code never raises what the model said.                                                            |

## Decisions

1. **Matching judges proposals, inside its runs.** The requirements, the judgment, the quote check, the worker with its limits and refusals, the record of calls under `matching_run` and the page operators read runs on are all there. A proposal is one more thing a run judges against the same instructions, so the provider's cache serves it too. A second engine would copy all of it.
2. **`matching` reads `proposal`** through `UseCaseProposals.sentTo`, and hears `UseCaseProposalSent`. It is a new dependency edge, recorded in [ADR 0010](../../../decisions/0010-matching-reads-the-proposals-a-use-case-received.md). `proposal` does not learn of matching: the web reads both and puts them together, as it does for "Proposal received" on a candidate.
3. **No score, no rank, no group.** The brief says "assist comparison". GenAI Fund decided in BEY-213 that people score applications on their own rubric, and a number from the AI beside the decision buttons would lead the decision. The table shows statuses; its order is the received list's order.
4. **The same requirements as matching.** Every proposal is judged against one list, the one the Matched solutions page shows: the shared criteria the brief names. A use case with no run yet gets one when its first proposal arrives.
5. **The proposal's own words first.** What a vendor wrote for this use case is the most specific source, so it comes before the solutions' material, and the limits keep it whole: the PDF is read to 40 pages and 30,000 characters, the approach and the team as written. Each solution's material is read to matching's usual limits.
6. **Only sent proposals.** A draft is the provider's own, and a withdrawn proposal is no longer the organization's to read. An evaluation kept for a proposal that is withdrawn stays in its row and is not answered; sent again, it is judged again only if what it says changed.
7. **One table, not a new page.** The proposals already have a page with tabs and decisions. Compare is another view of the same list, so the tab, the decisions and the outcomes stay where people found them.

## Data

`V105` (number checked against `main` before the merge):

- `matching_proposal`: one row for each proposal judged, keyed `proposal_id`: `use_case_id`, `stamp` (when the proposal was sent or last edited, as judged), `required_met`, `required_total`, `findings jsonb` (as a candidate's: `requirements` and `problem`), `summary`, `unread text[]` (`proposal_deck`), `fingerprint`, `run_id`, `judged_at`.
- `matching_run.origin` takes `proposal`.

## HTTP

| Request                                            | Who              | Answer                                                                                                                                                                                                                                       |
| -------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/matching/use-cases/{id}/proposals`       | Member, operator | Whether a model is chosen, the last run, the requirements, and for each proposal the use case holds now: its state (`judged`, `outdated`, `waiting`), the solutions by place, the summary, the unread sources and the findings with `sourceUrl` |

The same callers as the Matched solutions page; anyone else is told there is no such use case.

## Screens

- **Compare.** The table scrolls sideways when it does not fit. Its head names each proposal by its organization and links to the proposal. A cell is a button that opens its popover; a cell of a proposal not read yet says Being read. Above the table one line says the AI read each proposal and the vendor's own material, and that the reader should check. With no requirement read yet, the table says the AI has not read the brief and leads to Matched solutions.
- **The card.** As the evidence of a solution in Matched solutions: the requirement's statement, Must have, the status, the reason, the quote, and the line under it ("From their proposal PDF, page 3", "From Claims Desk's deck, page 4", "Found on their website · perxtech.com"). A quote from the proposal's PDF names the page; the PDF opens from the File card below.
- **Words.** "Requirement", "Met", "Partly met", "No evidence", "Must have", as Matched solutions says them. The AI's sentences and the vendors' words stay in English on the Vietnamese page.

Not in this increment: live updates while a run reads the proposals (the page shows the state it read), opening the proposal PDF at the quoted page, a download of the comparison, a filter by requirement.

## Out of scope

- AI scores or a ranking of proposals.
- Program applications: their judges score them on the program's criteria (BEY-38, BEY-213), and the brief asks for an evaluation "against a use case".
