# A Just me is an ordinary organization

Status: in progress, 14 October 2026 ([plan](plan.md)). It reverses what [BEY-189](../../completed/bey-189-solo-applicant/design.md) hid, at the product owner's request: "a Just me must simply stay an ordinary organization that happens to have one person: visible everywhere like a team or a company, and editable and switchable."

## Why

BEY-189 made an organization of type `independent_builder` ("Just me") disappear from the app. The account menu read "My solutions" instead of "My organization"; the profile and members pages redirected away; the backend refused to save it or to change its type (`ORGANIZATION_INDIVIDUAL`); the proposal wizard hid Edit for it; the public page, the organization pickers and the use cases left it out. A person on their own could not correct the name they gave, add a description or a logo, or later grow into a team without going back through an application.

## Domain story

Lan chose **Just me** and her organization "Lan Nguyen" was made, approved at once. Her account menu reads **My organization**, as a team member's does. She opens it, sees the same Profile, Members, Solutions and Use cases tabs, renames it "Lan Studio" and adds a description and a logo. Her solution page reads "By Lan Studio" and links to its page.

Six months later she hires two people. She opens the profile, changes the type to **Builder team** and chooses a size; the organization now waits for GenAI Fund's review like any new team, she can invite people once it is approved, and nothing else about it changes. If a team of one wants to be Just me again, it can, provided nobody else is in it and no invitation is open.

In a use case proposal, step 1 shows her organization with **Edit** and a **My organization** link; the Review step shows the same.

## Rules

| Topic        | Rule                                                                                                                                                                                                                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visible      | Menu, profile, members, solutions and use cases pages, public page, solution links, the operators' record page with its approve and take-down: as for a team or a company.                                                                                                                                                      |
| Editable     | Its owner saves the profile (`PUT /api/organization/mine`) and the required facts (`PUT /api/organization/mine/basics`) with any type, Just me included. The name is the one given; the application's contact name no longer renames it.                                                                                        |
| Switch       | Between Just me, a team, a company and other, from the organization form and from the wizard popup (which offers the first three), in every direction.                                                                                                                                                                          |
| To Just me   | Team size is forced to just me. The organization has no other member, no open invitation and no open request to join, else `ORGANIZATION_NOT_ALONE` (409). Its domain and domain join are cleared, since one person has none. One waiting for review or sent back is approved; a refused or taken-down one keeps that decision. |
| From Just me | A real team size, else `ORGANIZATION_TEAM_SIZE_REQUIRED` (400). An approved organization then waits for GenAI Fund's review like a team a person makes (the rule `becomeTeam` already applied in Apply); a refused or taken-down one keeps that decision. A company keeps its required industries, website and year.            |
| Created      | Unchanged: a new Just me is approved at once and never queued; a new team or company waits for review.                                                                                                                                                                                                                          |
| One person   | Unchanged: a Just me invites nobody, has no domain or domain join, an operator cannot set a domain, and nobody finds it in the join search or joins it (`ORGANIZATION_INDIVIDUAL`, 409). They become possible once it is a team or a company.                                                                                   |
| Apply        | Unchanged: step 1 may still turn a Just me into a team or leave it for a company until something was sent under its name (`PROPOSAL_INDIVIDUAL_LOCKED`). Apply no longer rewrites the name on each save; the card shows the organization's name.                                                                                |

## Decisions

1. **Restore by reading what BEY-189 changed, item by item.** Restored to the pre-BEY-189 behaviour: the menu, the profile and members pages, the frame's tabs and in-review notice, the use case writer rule, the public page and organization lookups (`OrganizationDirectory`, `OrganizationName`), the public solution organization slug, the operators' approve and take-down buttons and public page link, the submitted record's team size row, the solution card, page and deployment card links.
2. **Kept from BEY-189:** approval at creation and `V96`; the refusals for invitations, domains and domain join; `becomeTeam` and `leaveIndividual` in Apply with their lock; the join search leaves a Just me out (one person cannot be joined); the operators' suggested domain is none for it, since an operator cannot set one.
3. **Dropped from BEY-189:** `renameIndividual` (it overwrote what the owner typed), the naming by the account on creation (the name given is kept), `requireSameKind`, the type restriction `typesFor`, the redirects, the individual branches of the menu and frame, and the "individualTitle" and "My solutions" words.
4. **Review on a switch is an existing rule applied.** Going from Just me to a team puts an approved organization back in review exactly as `becomeTeam` did; going to a company is the same, so the review of companies is not weakened by passing through Just me.
5. **Words.** The vocabulary names the type "Just me" (it read "Individual", before BEY-189 "Independent builder"), as the choice cards and the owner call it. Apply keeps its own "Individual" choice.

## Changes

Backend: `OrganizationService.save` and `saveBasics` accept the type change and call `Organization.settleTypeChange`; `requireTypeChange` guards it; `OrganizationErrorCode.NOT_ALONE` and `TEAM_SIZE_REQUIRED`; `ORGANIZATION_INDIVIDUAL` is kept for invitations and domains, with words that no longer say "apply as a team"; `ProposalService.save` no longer renames; `UseCaseService`, `OrganizationDirectory`, `OrganizationQueryRepository` and the solution directory and its public records are as before BEY-189 (`organizationSlug` is required again in `openapi.yml`).

Web: the account menu and header, the organization pages and frame, the form (all four types, the size follows the type), the wizard popup (three choices for every organization, the size follows the type), the wizard's organization card and Review step (Edit and a My organization link for every type, in `proposal-organization-actions.tsx`), the solution components, and the English and Vietnamese words (the new error codes, "Just me").

## Failures

- `ORGANIZATION_NOT_ALONE` (409): becoming Just me with other members, open invitations or open requests to join.
- `ORGANIZATION_TEAM_SIZE_REQUIRED` (400): becoming a team, a company or other from Just me with the size just me.
