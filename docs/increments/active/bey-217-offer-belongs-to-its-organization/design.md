# An offer belongs to the organization that gives it

Tracked in Linear as BEY-217, under BEY-34. It replaces GenAI Fund's list of [a solution comes with offers](../bey-148-solution-offers/design.md) (BEY-148), and the reason for the closed state of [an offer is closed to new solutions](../bey-158-offer-close-and-record/design.md) (BEY-158).

## The problem

BEY-148 built two kinds of offer: GenAI Fund's list, which every solution chose from, and an organization's own. Any owner could choose any offer of the list, and it showed at once on an approved solution with GenAI Fund's mark. A provider could put "$1,000 AWS credits" on its own card, and a reader takes the mark as GenAI Fund saying the provider gives AWS's credits. The design named it a known limit and left it to an operator who happened to see it. BEY-158 closed an offer to new solutions so that one meant for a few partners stopped being chosen, which still left it open to any solution until it was closed.

What GenAI Fund asked for points the other way:

- At the kickoff on 2 October Kai named partners such as OpenAI that offer credits: "we can allow them to create an offer here" ([transcript, 07:40](../../../research/sources/2026-10-02-kickoff-transcript.md)).
- GenAI Fund's note of 12 October: the perks of AWS and Microsoft on Builder Hub, one line on a solution's card, such as "$1,000 AWS credits".
- Builder Hub, GenAI Fund's perks platform, keeps each perk with the organization that gives it (AWS's credits with AWS) and lets an organization post its own (`/dashboard/organizations/perks/new`). Its public API (`/v1/perks`) lists 34 perks, 14 of them open on 18 October 2026.

## What changes

1. **Every offer belongs to the organization that gives it**, and only that organization's solutions come with it, whoever chooses. There is no list every solution chooses from.
2. **An organization writes its own offers** as before: its members add, change, close and delete them on My organization › Solutions and while they edit a solution.
3. **An operator writes an offer for any organization** on the Offers tab of the organization's record, beside its profile and members, or from the picker on the record of one of its solutions. A partner such as AWS was imported with nobody signed in for it, so its offers are entered by GenAI Fund.
4. **GenAI Fund marks what it arranged.** An operator says whether GenAI Fund arranged an offer with the organization; the card and the page mark it as before. A new offer starts without the mark. An organization does not set the mark, and does not change, close or delete an offer that carries it.
5. **Admin › Offers lists every organization's offers**, by organization and title, with the mark. It no longer adds an offer, and stays one entry of the sidebar.

## Decisions

- **The organization that gives an offer owns it.** `offer.organization_id` is required. A solution comes with an offer only when both belong to one organization (`SolutionOffers.choose`), so no card carries an offer its organization does not give.
- **The mark is a column, set by an operator only.** `offer.from_genai_fund` replaces "the organization is null". The API keeps the name `fromGenAiFund` on every answer, so the card, the page, the picker and the search index read it unchanged.
- **An offer GenAI Fund arranged is GenAI Fund's to change.** A member's save, close or delete of one answers `SOLUTION_OFFER_ARRANGED`. The organization still chooses it for its solutions and takes it off them. The alternative, letting the organization edit an offer GenAI Fund vouches for, would let the words under the mark change without anyone at GenAI Fund reading them.
- **An offer is written on its organization's record.** An offer belongs to an organization, not to one of its solutions, so the record of the organization holds an Offers tab, as My organization › Solutions holds its members' offers. `POST /api/solution/admin/offers` takes the organization, which the tab and the picker on a solution's record pass. A dialog on Admin › Offers would need to find the organization among all of them, and the operators' list of organizations to start a solution for stops at 50. The tab is drawn by the solution area and handed to the organization's page by its route, since the organization area depends on no other.
- **Admin › Offers stays an entry of the sidebar, not one under Solutions.** The sidebar has no entry under another; an area with pages of its own (Email, MCP, a program) shows them as tabs on its page. Admin › Offers is the one list of every organization's offers, read across organizations.
- **The mark starts off.** It says GenAI Fund vouches for the offer, so an operator who forgets it leaves an offer unmarked, which is corrected, rather than marking a provider's own offer as GenAI Fund's. Builder Hub's perks are entered with the mark set.
- **The titles of an organization's offers are kept apart by the service**, as BEY-148 kept the organizations' own. The unique index on the titles of the old list goes with the list.
- **Closing stays for an offer that is full.** It is not needed any more for an offer meant for a few partners, which now belongs to them. An organization still reopens what an operator closed when the offer is its own; an operator who needs it gone takes it off the solutions or deletes it.
- **The migration gives each old list offer to the organizations that use it.** An offer of the list goes to each organization whose solutions come with it, as a copy of its own marked as arranged, and those solutions come with the copy. One no solution comes with has no organization and is deleted. Production had no offer on 18 October 2026; staging had three of the list.

## Not in this increment

- Entering Builder Hub's open perks for their organizations on production. That is data, entered after the release.
- A review of an offer an organization writes. It shows at once, without the mark, as every other change to an approved solution does.
- Claiming through a form, as two of Builder Hub's perks (OpenAI, UnifyAPI) do: such an offer links to its page on Builder Hub.

## Known limits

- An organization's own offer has no review; an operator corrects or deletes it on Admin › Offers.
- An offer that should go with two organizations is written once for each.
