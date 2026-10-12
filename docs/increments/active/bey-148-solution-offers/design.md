# A solution comes with offers

Tracked in Linear as BEY-148, under BEY-34. Source: a note from GenAI Fund on 12 October 2026. AWS and Microsoft have offers on the perks page of Builder Hub, and a solution's card in the directory should say its offer in a line, such as "$1,000 AWS credits".

## The problem

A solution's card says what the solution does and what proof it has. It has no place for what a customer gets with it. A partner such as AWS is listed with a description cut after two lines, and the credits GenAI Fund arranged with it are on another platform, where a visitor of the directory does not look. The companies that offer perks on Builder Hub went live as solutions without their perks, which were left for later (BEY-137).

## What changes

1. **Two kinds of offer.** An offer is one line, at most 80 characters, and the https address where it is claimed. GenAI Fund keeps a list every solution chooses from, which operators write on a new admin page, `/admin/offers`. An organization writes offers of its own, which only its solutions come with: its members add, change and delete them on My organization › Solutions, and add one while they edit a solution.
2. **A solution comes with offers.** At most five, of GenAI Fund's list or its organization's own. One offer goes with as many solutions as it should, so it is written once. Its owners choose them in the first step of the editor; an operator chooses them in the editor of a draft and on the record of a submitted solution.
3. **The card says the offer.** A line under the summary, on a tint of its own, names the first offer and counts the rest; the count opens the others under the pointer, on focus or on a tap, each a link. A gift in the corner of the cover leads to where the offer is claimed: with one offer it is the link itself, with several it shows how many and opens their list.
4. **The page of the solution names each offer** beside a `Claim offer` action. An offer of GenAI Fund's list carries GenAI Fund's mark wherever it is read; an organization's own has none.
5. **A search for an offer finds the solutions that come with it**, in the directory and in the search index.

## Decisions

- **An offer is a record of its own, shared by solutions.** This replaces the shape the Phase 1 domain model planned ([its design](../bey-22-phase-1-domain-model/design.md)), where `solution_offer` was a record of one solution with a description, a value, eligibility, terms, an expiry, a claim method and a status. The same credits go with several solutions, and the address of an offer changes on the partner's side: one shared record is corrected once, a record per solution would be corrected on each and drift. Of the planned members only the title and the address to claim at are built, and only the `link` way of claiming.
- **Many to many, by the pattern the repository has.** `solution_offer` links a solution to an offer with a foreign key on each side, as `use_case_program` links a use case to a program. The solution holds the identifiers as an element collection, so a change to them moves the solution's version like any other change to it.
- **Both GenAI Fund and an organization write offers.** Who creates offers is a question still open with GenAI Fund (BEY-25); the domain model expected GenAI Fund, and its alternative was that providers post their own. Both are built, decided on 12 October 2026: what GenAI Fund arranged with a partner is GenAI Fund's to state, and a provider knows its own pilot package without asking anyone. This replaces the first shape of this increment, in which only operators wrote offers and owners chose from their list.
- **An organization's offer is its own.** `offer.organization_id` names the organization that wrote it; null is GenAI Fund's list. A solution comes only with offers of GenAI Fund's list or of its own organization, so one company cannot put another's offer on its card. A merge of two organizations moves the offers with the solutions.
- **No review of an organization's offer.** It follows its solution: a draft is reviewed as a whole, and a change to an approved solution shows at once, as every other change to it does. The price is an address on a public card that nobody at GenAI Fund read. An operator sees every offer with the organization that wrote it on `/admin/offers` and changes or deletes it there.
- **GenAI Fund's offers are marked.** The mark the card gives to what GenAI Fund says of a solution stands beside an offer of its list, with the words for those who do not see it, so a visitor tells what GenAI Fund arranged from what a provider wrote.
- **A title is its own among the offers it is chosen beside.** The database keeps the titles of GenAI Fund's list apart; an organization's are kept apart by the service only, so that merging two organizations never fails on a title both wrote.
- **Only https.** The record, the request and the database each refuse another scheme. The link opens a new tab with `rel="noopener noreferrer nofollow"`.
- **The gift is a link of its own, not a button on a link.** The card is covered by the link to the solution's page; the gift sits above it, as the organization's name and the capabilities already do. With one offer it is an anchor, so it is announced as a link that leaves the site.
- **Several offers open a list.** One press cannot lead to two addresses. The list is a popover of links, the pattern the card already uses for the capabilities it does not show.
- **The line stands out by its ground, not by motion.** It sits on the `lemon` tint with its own foreground, which a reader scanning twelve cards picks out. A frame that moves was considered and left out: several of them on one page compete with what the cards say, motion that does not stop has to be stoppable and off under reduced motion, and a card GenAI Fund features carries no mark at all, so an offer its owners chose would be louder than GenAI Fund's own choice.
- **A change to an offer shows at once, with no review.** A change publishes `SolutionChanged` for each solution that comes with the offer, so the search index writes their cards again.
- **An offer is deleted only when no solution comes with it.** The foreign key refuses the deletion otherwise, and the service answers `SOLUTION_OFFER_IN_USE`. The deletion is real: an offer is a line of a list, not a record with a review, and the audit trail keeps that it existed and who deleted it.
- **The offers travel in the search index as the backing line does.** With a search term the directory reads its cards from the index, so a card would lose its gift whenever a visitor searched. `IndexedSolution` carries the offers, the index keeps them in the facets of the row and their titles in its text, and `SearchItem` answers them.
- **The picker reads the list itself.** The editor of a solution opens on three pages and in a dialog over a proposal. The picker asks for the list when it is drawn, as that dialog asks for its solution, so no page has to pass the list down.
- **The lists of offers are not paged.** The operators' and an organization's each answer every offer in one read, as the organizations an operator starts a solution for are. They get pages when they outgrow a screen.

## Not in this increment

- A filter of the directory for solutions that come with an offer.
- Counting how often an offer is claimed.
- An offer that ends on a date, or that only some visitors may claim.
- Claiming by a request the provider accepts, and the description, value, eligibility and terms the domain model listed for an offer.
- Reading the offers from Builder Hub. Whether that platform is integrated or replaced is not decided ([vision](../../../vision.md)); an operator enters its offers by hand.

## Known limits

- An owner may choose any offer of GenAI Fund's list for their solution, and write any offer of their own; either shows at once on an approved solution. Nothing checks that an offer of the list was arranged for that solution, or reads the address of an organization's own; an operator who sees a wrong one takes it off on the record or deletes it.
- The order of a solution's offers is by title. An owner cannot put one first.
- The line of an offer is in one language, as it was written.
