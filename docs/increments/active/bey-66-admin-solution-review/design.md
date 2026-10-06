# The operators' review of solutions: the queue and the record

Tracked in Linear as BEY-66, under BEY-34. Source: a UX review of `/admin/solutions` and `/admin/solutions/[id]` on 6 October 2026, and the Figma frames `Admin — AI solutions, needs review`, `Admin — AI solutions, nothing waits`, `Admin — AI solution, review record` and `Admin — AI solution, send back with a reason (dialog)` in the section `AI solutions — list and detail`.

## The problem

An operator reviews many solutions in a row. The two screens make that slower than it has to be:

- The decision sits in the page header, so after reading a long record the operator scrolls back up to decide.
- A field its owners left empty is not drawn at all, so "not provided" looks the same as "not shown". The product principle is that what is unknown is shown as unknown.
- Approving a solution says nothing about its customer deployments that still wait for review.
- The queue opens on every status, has no count of what waits, and a row opens only through a small link at its far end.
- The search field says "solution or organization" and the list matches the solution's name only.
- Neither screen says who sent the solution for review.

## What changes

1. **Search and filters of the queue.** The text matches the solution's name or its organization's name. The list narrows by industry. The response carries how many solutions wait for review, whatever the filters, for the label of the tab.
2. **Who sent it.** A solution records the account that submitted it. The queue and the record name that person.
3. **The queue.** Tabs by status with the count of those that wait, opening on `Needs review`. Columns: solution with a one-line summary, organization, status, sent by, waiting. The solution's name is the link that opens it.
4. **The record.** What the solution says, as labelled rows in three groups (`Basics`, `Who it is for`, `Evidence`), with `Not published yet` where its owners gave nothing. The decision is a panel that stays in view: status, who sent it, how long it has waited and its place in the queue, then `Approve`, `Send back` and `Next waiting`, each with its key.
5. **Customer deployments at the decision.** The panel says how many deployments wait. Those already decided are folded.

## Decisions

- **The organization's name is asked of `organization`.** A table has one owning module, and only its `persistence` package reads it ([schema ownership](../../../guidelines/persistence.md#schema-ownership)). `OrganizationDirectory` gains a method that answers the identifiers of the organizations whose name contains a text; `solution` narrows by those identifiers. No new module edge: `solution` already depends on `organization`.
- **`submitted_by_account_id` is a new nullable column.** The audit trail records decisions, not submissions, and the account that created a draft is not always the one that sends it. Solutions submitted before this change keep the column empty and show the sender as unknown. Nothing is guessed from `created_by_account_id`.
- **The operators' list gets its own summary record.** `SolutionSummaryResponse` also serves an organization's own list, which has no use for the sender or the organization's name beyond what it already has. `AdminSolutionSummaryResponse` carries the sender and the industries; the organization's list is unchanged.
- **One count, not one per status.** The tab that matters is `Needs review`. Counts for approved and rejected would add two queries to every page for a number nobody acts on.
- **The decision panel replaces the header buttons, it does not add a second set.** One place to decide, in view at every scroll position from 1024px; under that width it is a bar at the bottom of the screen, as the public solution page already does for its call to action.

## Not in this increment

- `Milestones and traction`, `Built with`, `Languages`, `Best customer profile` and a deck as an uploaded file. The Figma record draws them on the solution. `main` moved the deck file, built-with and traction to the application on 6 October 2026 (commit `22fc3c3`, BEY-37: "the solution stays as it is"), and the [demo and deck increment](../bey-34-solution-demo-and-unlisted/design.md) chose links over uploads for the solution. Whether the solution gains them again is an open decision recorded on BEY-66; the record screen is built from labelled rows so a field is one row to add.
- Keys for deciding on a customer deployment, and bulk decisions.

## Known limits

- The count of what waits covers solutions, not customer deployments that wait on an approved solution. The queue still sorts those first.
- A search by organization name reads the matching organizations first. With thousands of organizations sharing a word the list of identifiers is long; a join inside one module would need the two tables to share an owner.
