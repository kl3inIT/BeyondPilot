# A solution's logo, cover and images, and what its owners do from the list

Tracked in Linear as BEY-34. The screens are the frames of the section "AI solutions" in `BeyondPilot — Product UI`: "AI solutions — list, with covers", "Solution — detail, cover and 4 images" with its two-image, cover-only and sparse variants, "Solution editor — 3 Evidence, with images" and "nothing yet", "My organization — Solutions" with a row menu open on each state, its two confirmations and its toast, and "Admin — AI solution, review record". It follows [the solution editor in four steps](../bey-34-solution-editor-steps/design.md).

## What a person can do

- **Show the solution.** The Evidence step takes a logo (one square image, up to 2 MB), a cover (one image, 16:9, up to 5 MB) and up to four more images (5 MB each), in the order the person gives them by dragging a tile or with the arrows on it. Each is uploaded at once and named by the solution with its next save.
- **Know what a review needs.** A logo and a cover are needed before a solution is sent for review, beside its name, what it does, its stage, an industry and a capability. The review step lists both when they are missing and leads to each.
- **Recognise a solution in the directory.** A card shows the cover with the logo over its corner; the page of a solution shows the cover, and under it only the images the solution has. Any image opens large, with the others one step away.
- **Reach the company in one step.** The card beside the page leads with one action, "Request an introduction", says what it does, and lists the solution's facts under it, each with an icon.
- **Act on a solution from the list.** My organization › Solutions says for each solution where its review stands, whether the public reads it and what its owners do next. The row menu holds what fits its state: a draft is continued, sent or deleted; what is in review is read or edited; what was sent back is fixed and sent again; what is approved is opened, its link copied, and hidden from the directory or shown in it.
- **Review what visitors will see.** An operator's record of a solution shows its images above the rest of its evidence, and says which are missing.
- **Read what GenAI Fund says of a solution.** An operator writes who backs its company, the programme it was selected for and its funding. The card of the directory shows the programme, or else who backs the company, with a mark; the page shows the three among its facts and the programme as a kind of proof.
- **Say which channels a solution works through.** One optional line in the step "Who it is for", shown among the facts of the page.

## Decisions

1. **Three kinds of image, two purposes.** The logo has the purpose `solution_logo` because it may be smaller (2 MB); the cover and the images under it share `solution_image` (5 MB). Both purposes are read by anyone who has the address of the file, like a program's image and a talent profile's photo: an approved solution is public, and a draft's images sit at an identifier nobody can guess.
2. **The solution names its images; the images know nothing of the solution.** `logo_file_id` and `cover_file_id` are columns with a foreign key, each unique. The images under the cover are an ordered `uuid[]`: the order is the content, there are at most four, and a table would add a join for no rule it could check that the array cannot. An array has no foreign key, so `SolutionService` checks each new file itself and is the only one that removes these files.
3. **An image belongs to one solution and one place.** A new image is a stored file of the right purpose that the caller uploaded and that no solution names. An image the solution already has stays, whoever of its organization uploaded it, and may move between the cover and the images under it; a logo stays a logo. A file named twice in one save is refused. Each refusal is `400 SOLUTION_IMAGE_NOT_USABLE`.
4. **Files a solution stops naming leave the store after the save commits**, as its deck already did. `ReplacedDecks` becomes `DroppedFiles` and serves both.
5. **A logo and a cover are needed for review.** Decided with the assignee of BEY-34 on 6 October 2026. `Solution.missing()` names what a solution lacks, in the order of the editor; `complete` is true when it lacks nothing.
6. **A save takes nothing away from a reviewed solution, and asks for nothing it never had.** Before this change a save of a submitted or approved solution was refused when it left the solution incomplete. With two more things needed, that rule would refuse every save of a solution approved without images, including the application flow's save and hiding it from the directory. The rule is now: a save of a submitted or approved solution may not make it lack anything it did not lack before. A solution approved without a logo keeps working; one that has a logo cannot lose it. The editor still asks for both before it saves a reviewed solution, because that is where they are added.
7. **The list of an organization says what is missing.** `SolutionSummary.missing` carries the same names as `Solution.missing()`, so the row of a draft counts what is filled and its menu offers "Send for review" only when nothing is missing. It carries the reason and the message of the last send-back too, which the row shows.
8. **Sending for review stays in the editor.** "Send for review" and "Send again" in the row menu open the review step, where the solution is read back and the confirmation is. Nothing is sent from a menu unread.
9. **Hiding and showing use the save that exists.** The row menu reads the solution and saves it with `listed` changed. Hiding asks first; showing does not. No address is added for it.
10. **Nothing that was sent for review is deleted, and nothing is withdrawn from review.** The backend has neither, and the menus offer neither.
11. **`Button` has a size `xl`, 48px**, for the one action a page leads to. The frames draw "Request an introduction" at that height.
12. **What GenAI Fund says of a solution is written by operators, on the solution.** The frames draw "Backed by", "Program" and "Funding" with a mark that reads as GenAI Fund's word, so owners cannot write them: `PUT /api/solution/admin/solutions/{id}/backing` takes the three lines from an operator, records `solution.back` in the audit trail, and a line left empty is taken away. They are free text of at most 120 characters, kept on the solution because the card and the page are a solution's; deriving the programme from released application outcomes is left to the owners of BEY-38.
13. **Proof is read from what the product holds, each under its kind.** "Programme selection" is the programme an operator wrote, confirmed by GenAI Fund with its date. "Stated by the company" is the owners' milestones and traction, said to be theirs. "Customer case" counts the customer deployments GenAI Fund approved, which follow in their own part, "Customer references & case studies". No claim is invented: a kind without anything behind it is not drawn, and a solution without a customer case says so.
14. **A fact the solution does not state reads as unknown**, as before: the facts beside the page keep the rows the frames draw.
15. **The list of an organization shows the review as a pill with its own words**: Draft, In review, Sent back, Approved. The vocabulary shared with the operators keeps "Changes needed".
16. **A solution in the search result shows its logo**: `IndexedSolution` carries it, and the search item's picture is a person's photo or a solution's logo.
17. **The frame "the organization is not a provider" is not built.** The organization's roles were dropped by `V28`, so no organization is in that state.

## HTTP

| Path                                                                    | Change                                                                                                                                                                                             |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUT /api/solution/mine/{id}`                                           | Takes `logoFileId`, `coverFileId` and `imageFileIds` (at most four, in their order). `400 SOLUTION_IMAGE_NOT_USABLE` for a file that cannot be that image; `400 SOLUTION_INCOMPLETE` as decision 6 |
| `POST /api/solution/mine/{id}/submit`                                   | `400 SOLUTION_INCOMPLETE` also without a logo or a cover                                                                                                                                           |
| `GET /api/solution/mine`                                                | Each item answers `missing`, `decisionReason` and `decisionMessage`                                                                                                                                |
| `GET /api/solution/mine/{id}`, `GET /api/solution/admin/solutions/{id}` | Answer `logo`, `cover` and `images`, each with its file, name and size                                                                                                                             |
| `GET /api/solution/solutions`                                           | Each item answers `logoFileId` and `coverFileId`                                                                                                                                                   |
| `GET /api/solution/solutions/{slug}`                                    | Answers `logoFileId`, `coverFileId` and `imageFileIds`                                                                                                                                             |
| `PUT /api/solution/admin/solutions/{id}/backing`                        | New: an operator writes `backedBy`, `program` and `funding`; `404` for a draft                                                                                                                     |
| `POST /api/storage/uploads`                                             | Accepts the purposes `solution_logo` (up to `beyondpilot.storage.solution-logo-max-size`, 2 MB) and `solution_image` (up to `beyondpilot.storage.solution-image-max-size`, 5 MB)                   |

The saves and the answers of a solution also carry `channels`; the answers carry `backing`, and an item of the directory carries it as one line. An item of `GET /api/search` carries a solution's logo in `photoFileId`.

The bytes of an image are read at `GET /api/storage/files/{id}`, without a session.

## Data

- `V29__storage_allow_solution_images.sql`: the purposes `solution_logo` and `solution_image`.
- `V30__solution_add_images.sql`: `logo_file_id`, `cover_file_id` and `image_file_ids` on `solution`. The rows that exist start without images and keep their status.
- `V31__solution_add_channels_and_backing.sql`: `channels`, and `backed_by`, `program`, `funding` with `backing_updated_at`, on `solution`.

## Web

- `features/solution/image-upload.tsx` holds the logo and cover control and the control of the images under the cover; `solution-gallery.tsx` shows them on the public page; `solution-row-actions.tsx` is the row menu with its confirmations.
- `SolutionLogo` draws the stored logo, or the initials where there is none.
- The public page keeps one column of reading and one card beside it. On a phone the card comes right under the images, before the reading.

## Known limits

- What GenAI Fund says of a solution is typed by an operator, not read from the programs and their outcomes, so it can differ from them.
- An image is stored as it was uploaded: nothing checks that a logo is square or a cover 16:9, and nothing resizes it. The pages crop to their frames.
- A solution approved before this change has no cover: its card shows an empty frame until its owners add one in the editor.
- An upload that is never named by a solution stays in the store until the cleanup of abandoned uploads exists.
- The row menu is a menu on a phone too; the frames draw the same.
