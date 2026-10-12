# An offer is closed to new solutions, and an operator reads its record

Tracked in Linear as BEY-158, under BEY-34. It follows [a solution comes with offers](../bey-148-solution-offers/design.md) (BEY-148). Source: a request from the product owner on 12 October 2026.

## The problem

An offer is a title and the address where it is claimed. Whoever may choose it may choose it for as long as it exists, and the only way to stop that is to delete it, which is refused while a solution comes with it. Two cases have no answer:

1. **An offer with a limit.** A partner gives 100 claims. When the people who run the offer see that it is full, no further solution should take it.
2. **An offer for a few partners.** GenAI Fund arranges an offer for one or two solutions. Once they come with it, no other solution should choose it, and those two keep showing it in full so that it is claimed.

An operator also reads little about an offer on `/admin/offers`: the page counts the solutions that come with it and does not name them.

## What changes

1. **An offer is open or closed.** A closed offer is not among those a solution chooses, and no solution starts to come with it. A solution that already comes with it keeps it, and its card and page show it as before, with the same link to claim it.
2. **Its writer and an operator close and reopen it.** An operator closes and reopens any offer on `/admin/offers`. A member of the organization that wrote an offer closes and reopens it on My organization › Solutions.
3. **An operator reads the record of an offer** on `/admin/offers/{id}`: its title and address, who wrote it, when it was created and last changed, whether it is open, and the solutions that come with it, each with its organization, its state and a link to its record.
4. **The lists say the state.** The operators' list and an organization's own show which offers are closed, and the operators' list is filtered by state.

## Decisions

- **Closing stops new choices and nothing else.** Hiding a closed offer from the public card was considered and left out: it serves the offer that is full and breaks the offer for a few partners, whose whole purpose is to stay on their cards after it is closed. An offer that should leave a card is taken off the solution, which an owner does in the editor and an operator on the record.
- **`offer.closed_at`, null while open.** A time and not a flag, so that the record says since when. No state beyond the two is built: an offer is not reviewed and does not end on a date.
- **The picker keeps what the solution already has.** The offers a solution may choose (`SolutionOffers.options`) are the open offers, and the closed ones this solution comes with, marked closed. A save that names a closed offer the solution already comes with is accepted, so an owner who edits another field is never refused; one that names a closed offer it does not come with answers `SOLUTION_OFFER_NOT_USABLE`, as an offer of another organization does. An owner who takes a closed offer off cannot put it back, and the picker says so beside it.
- **One endpoint sets the state.** `PUT /api/solution/admin/offers/{id}/closed` and `PUT /api/solution/offers/{id}/closed` take `{ closed, version }`. The version is checked as on a save, and closing moves it, so a form opened before answers `SOLUTION_OFFER_CHANGED_MEANWHILE`. Setting the state it already has changes nothing and records nothing.
- **Who closed it is not kept on the offer.** A member of the organization may reopen an offer of theirs that an operator closed. The audit trail records each close and reopen with its actor (`SOLUTION_OFFER_CLOSE`, `SOLUTION_OFFER_REOPEN`), and an operator who needs an offer to stay closed takes it off the solutions or deletes it. Keeping the closer and refusing the organization was considered and left for when it is needed.
- **No `SolutionChanged` on close.** A card reads the same before and after, so the search index has nothing to write again.
- **Deletion is unchanged.** An offer, open or closed, is deleted only when no solution comes with it.
- **The record is a page, as a solution's is.** `GET /api/solution/admin/offers/{id}` answers the offer with its solutions in one read, not paged, as the lists of offers are not. A row of the list leads to it.
- **A merge of organizations needs nothing new.** `closed_at` is a column of the offer and moves with it.

## Not in this increment

- Counting claims, and closing an offer by itself when a number is reached. A claim happens on the partner's page, which BeyondPilot does not see.
- An offer limited to named solutions before they choose it. The order is: the solutions choose it, then it is closed.
- Hiding a closed offer from the directory.
- The history of an offer on its record. The audit log keeps it.

## Known limits

- Between the creation of an offer for a few partners and its closing, any solution that may choose it can. An operator reads who did on the record and takes it off.
- An organization reopens its own offer whatever an operator did.
