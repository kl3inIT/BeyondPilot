# The solution editor in four steps, with a deck that is a file

Tracked in Linear as BEY-34. The screens are the frames "Solution editor — 1 Basics" to "4 Review and submit" of the section "AI solutions — list and detail" in `BeyondPilot — Product UI`, and their states in the section "AI solutions — editor states". It follows [demo and deck links, and unlisted solutions](../bey-34-solution-demo-and-unlisted/design.md), whose deck link it replaces.

## What a person can do

- **Write a solution step by step.** The editor of `/workspace/organization/solutions/{id}` is a page of its own, without the site's navigation: Basics, Who it is for, Evidence, Review and submit. Every step is reachable at any time, and the step is part of the address (`?step=fit`), so the browser's Back returns to the step before.
- **Not lose a draft.** A draft, and a solution that was sent back, save as the person types: only their organization reads them. The top bar says where the save stands: saving, saved at a time, or not saved with a way to try again.
- **Change what others read deliberately.** A solution in review or approved is read by operators or by anyone, so nothing is kept until the person chooses Save changes, and leaving with a change unsaved asks first.
- **Say more about the solution.** New, optional fields: milestones and traction, what it is built with, the languages it works in and its best customer profile. The public page and the operators' review show them.
- **Attach a deck.** One PDF of up to 25 MB, uploaded from the Evidence step and named by the solution with its next save. Anyone downloads the deck of an approved solution from its page.
- **See what a review still needs.** The last step reads the solution back by step, marks what is missing and leads to each missing field. Sending for review asks once more and is offered only when nothing is missing.

## Decisions

1. **`solution` depends on `storage`.** The edge is in the module list that [BEY-22](../bey-22-phase-1-domain-model/design.md) settled on 3 October 2026 and `program` already has. A solution names its deck by the identifier of a stored file, attaches only a stored PDF of purpose `solution_deck` that the caller uploaded and that no other solution names, and asks `StorageService` to remove a file it stops naming, after the save has committed (`ReplacedDecks`, as `program` does for a cover).
2. **The deck is read at the solution's address.** `GET /api/solution/solutions/{slug}/deck` answers anyone for an approved solution, listed or not. Before the approval, and after a solution is taken down, it answers the members of its organization, and the operators once the solution has been sent to them. Everyone else gets the same `404` as for a solution that does not exist. The purpose is not public in `storage`, so the file has no other address.
3. **One deck, as columns.** BEY-22 drafts a `solution_material` table for decks, demos and videos. The screens hold one deck and one demo link, so the solution keeps `deck_file_id` with the name, the size and the time it was attached, and `demo_url`. A table comes with the first screen that holds several.
4. **The deck link is dropped.** `deck_url`, added by `V11` on 6 October 2026 and released to staging the same day, is removed by `V18` with whatever it held; a link cannot become a file. Decided with the assignee of BEY-34 on 6 October 2026. The release before this one reads the column, so going back to it is a restore of the database.
5. **What a review needs does not change.** A name, what it does, a stage, an industry and a capability, as before. The frames draw the problem, the languages, where it runs and what it is built with as required too; the minimum set is an open question for the client, and a new required field would refuse the next save of every approved solution that lacks it. The editor marks every other field Optional. Widening the set is one method (`Solution.isComplete`) and one list (`reviewFields`).
6. **Saving as a person types is for what nobody else reads.** Autosave on an approved solution would publish half a sentence. The rule is the status: `draft` and `rejected` save by themselves, 1.2 seconds after the last change and before a step opens; `submitted` and `approved` save on request.
7. **One writer at a time, in order.** Every save carries the version the backend last answered with; a save waits for the one before it, and a change made meanwhile is saved next. A save the backend refuses is not repeated until what the editor holds changes or the person asks; a save that lost to another person's offers a reload.
8. **A link that is not an address is not sent.** The backend takes only `http(s)` addresses. Sending a half-typed link would fail the whole save, and sending none would drop the link that was saved, so the editor holds the draft unsaved until the link is one or is empty, and says what is wrong under the field once the person has left it.
9. **Vocabularies stay codes.** Industries and capabilities keep their vocabularies; the editor offers them in a combobox with chips, because both lists are too long to read as chips. Languages are a new closed vocabulary of ten codes, checked by the request and by the table. What a solution is built with is free text, at most ten names of forty characters.
10. **"What it does" takes 600 characters**, up from 300, as the frames draw it. The long answers keep their limit of 4,000: rows that exist may be longer than the 600 the frames draw.

## HTTP

| Path                                                                    | Change                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUT /api/solution/mine/{id}`                                           | Takes `traction`, `builtWith`, `languages`, `bestCustomerProfile` and `deckFileId`; no longer takes `deckUrl`. `400 SOLUTION_DECK_NOT_USABLE` when the file is not a stored deck of the caller or is another solution's |
| `GET /api/solution/mine/{id}`, `GET /api/solution/admin/solutions/{id}` | Answer the new fields and `deck` (file, name, size, when it was attached)                                                                                                                                               |
| `GET /api/solution/solutions/{slug}`                                    | Answers the new fields and `deck` (name and size)                                                                                                                                                                       |
| `GET /api/solution/solutions/{slug}/deck`                               | New: the PDF, or a redirect to where the object store serves it                                                                                                                                                         |
| `POST /api/storage/uploads`                                             | Accepts the purpose `solution_deck`: a PDF of up to `beyondpilot.storage.solution-deck-max-size` (25 MB)                                                                                                                |

## Data

- `V17__storage_allow_solution_decks.sql`: the purpose `solution_deck`.
- `V18__solution_add_editor_fields_and_deck_file.sql`: `traction`, `best_customer_profile`, `built_with`, `languages` and the deck's four columns on `solution`; `deck_url` dropped.

## Web

- `features/solution/solution-editor.tsx` holds the state, the saves and the frame; `solution-editor-steps.tsx` and `solution-review-step.tsx` hold the steps; `solution-editor-state.ts` holds what is decided without a screen and is unit-tested.
- `StepItem` is a composite: the frames name it, and the application flow of [BEY-27](../bey-27-main-flows-design/design.md) will use it.
- The list of an organization's solutions keeps the site's frame, in the route group `solutions/(list)`; the editor's route has none.
- `ComboboxChip` takes `removeLabel`: its remove button holds only an icon and had no accessible name.

## Known limits

- A change to an approved solution still shows at once, without a second review and without a snapshot of what was approved.
- The dialog's frame promises an email with the decision; the application sends none for a solution, and the dialog says the decision shows on the page.
- An upload that is never named by a solution stays in the store until the cleanup of abandoned uploads exists.
- Uploading shows that it is under way, not how far: the upload is one request.
- The public page offers the deck as a download; it has no preview.
