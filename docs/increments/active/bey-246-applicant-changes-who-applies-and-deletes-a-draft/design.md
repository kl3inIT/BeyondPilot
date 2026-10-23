# An applicant changes who applies, and deletes a draft

Tracked in Linear as BEY-246. On 23 October 2026 an applicant who had tried the application form as a team could not apply for his real company, and GenAI Fund had his records deleted by hand on production (recorded on BEY-242). What other products do is in the [research note](../../../research/2026-10-23-draft-and-organization-deletion.md).

## The cause

The form makes the organization someone applies through as soon as they say who applies (`ProposalService.organize`). That is deliberate: the draft, the solution and the deck belong to that organization from the start. Someone applying as themselves can change their mind while nothing was sent under their name: they become a team (`becomeTeam`) or leave to join a company (`leaveIndividual`). A team has no such way back. Its owner is its last owner, cannot leave, and belongs to one organization at a time, so a person who tried the form as a team is held there.

On production on 23 October, after that applicant's records were gone, 9 teams had sent nothing, each with its owner as its only member and no invitation. Each of those 9 owners is held in that team the same way.

## What a person can do

- **Change who applies while their team sent nothing.** An applicant whose team has them as its only member, no open invitation or request to join, is active, and has sent nothing sees **Change** on step 1, as someone applying as themselves does today:
  - choosing a team renames the team in place;
  - choosing themselves turns the team into the person on their own, in place;
  - choosing a company takes them out of the team so that the finder can join or add the company.

  A team that sent something, or that has someone else in it, stays as it is.
- **Delete a draft application.** The applicant deletes their own application while it is a draft, from its page, after a confirmation that says it cannot be undone. This works whether or not the program still takes applications. A submitted application keeps Withdraw.

## Decisions

1. **The way back already used for someone on their own is extended to a team; the organization is still made when the person says who applies.** Making it only at submission was weighed. It needs the draft to hold the team's facts, a new column, a second path for the solution and the deck, and care for the 59 drafts of the program open now. The cause is the missing way back, not the timing. Decided on 23 October 2026 by the member who directs BEY-246.
2. **"Sent nothing" keeps its meaning** (`sentAnything`): no submitted application, no use case proposal beyond a draft, no solution sent for review. A team also needs to stand alone: one member, no open invitation, no open request to join. The organization module answers that (`OrganizationDirectory.standsAlone`).
3. **Renaming and becoming oneself happen in place; going to a company leaves.** In place keeps the draft, the solution and the deck where they are. Leaving a team keeps the record with nobody in it, as leaving oneself does, for what was written under its name.
4. **A team left so becomes a builder on their own, under its name.** The company finder, the claims and the public pages already leave out someone on their own, so nobody is offered to join or claim the empty record. Hiding every team with no member was weighed and refused: operators add teams nobody joined yet, for their people to claim.
5. **A draft is deleted at once, after a confirmation.** Every reference read confirms first and deletes for good (decidim `destroy_draft`, pretalx discard). No one else has seen a draft, so a soft delete keeps nothing worth keeping. The team's rule of Undo over confirmation is for actions that can be undone; this one cannot. Chosen on 23 October 2026 by the member who directs BEY-246.
6. **The draft's files go with it unless something else names them.** The deck and the files its answers name are deleted from storage when no other application of the person names them, since a deck can carry over from an earlier application.
7. **A deleted draft is not audited.** No reference audits a draft; it was never sent and nobody else depends on it. The service logs it with the application's id.
8. **Deleting an organization from its page waits.** The research supports letting an owner delete an organization that holds nothing. With the way back above, the person held in a team is free without it. It stays open on BEY-246 for when an owner asks.

## HTTP

| Path                                                   | Change                                                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `POST /api/proposal/programs/{slug}/application/organization`       | Also renames a team that may change, or turns it into the person on their own                        |
| `POST /api/proposal/programs/{slug}/application/organization/leave` | Also takes the person out of a team that may change                                                  |
| `DELETE /api/proposal/applications/{id}`               | New: deletes the caller's draft, `204`; `404` for one that is not theirs, `409` for one not a draft  |
| `ApplyingOrganization.changeable`                      | Also true for a team that may change                                                                 |

The exact contract is `openapi.yml`.

## Web

| Where                     | What                                                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Apply, step 1             | **Change** on a team that may change; choosing a team, oneself or a company as above                                                |
| `/applications/{id}`      | **Delete draft** on a draft, with a confirmation; then back to the applications list with a notice                                   |
