# A person applying on their own is themselves, not an organization

Status: in progress, 14 October 2026. Linear: [BEY-189](https://linear.app/beyondpilot/issue/BEY-189). It changes how the applicant's organization of [BEY-37](../../../specs/proposal.md) reads; the behaviour table was agreed with the product owner on 14 October.

## Why

The brief lets an individual builder "participate without having to present themselves as an established company" (line 51), asks for "a lightweight experience" for one-person builder organizations (line 197), and accepts a solo builder who applies "without presenting a false established-company identity" (line 407). It prefers one lightweight organization that also holds a solo builder (line 56), which is what Apply builds: choosing **Individual** in step 1 makes an organization of type `independent_builder`, team size `just_me`, named after the person.

That organization was hidden only inside the Apply form. Everywhere else it was a company: in review with GenAI Fund, in the operators' queue, a "My organization" page asking for a description and a logo, members and invitations, a public company page, found by organization search, and organization emails. While it waited for review, the operator's dialog suggested the person's work domain as the organization's domain, so approving it could bind an employer's domain to a one-person organization and send that employer's staff to it.

## Domain story

Lan applies to a program on her own. In step 1 she chooses **Individual**; the card then reads "Individual · Lan Nguyen". She changes her last name in the same step and the card follows. Before she submits, she can still choose **Change** and apply as a team or a company instead.

Nothing waits for GenAI Fund about her: the program's judges read "Lan Nguyen · Individual", and her solution is reviewed when she lists it, as every solution is. Her account menu offers **My solutions**, not an organization. Nobody can find "Lan Nguyen" among organizations, ask to join her or invite people into her, and a listed solution reads "By Lan Nguyen" without a link.

## Rules

The stored record stays an organization of type `independent_builder`, so applications, solutions and judging keep working unchanged. The type is the mark: every organization of that type follows these rules, whichever way it was made (Apply, the Create organization page, an operator, an import).

| Topic   | Rule                                                                                                                                                                                                                   |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Review  | Approved when it is made, and never in review: no operator queue, no organization emails, no domain. An operator can still take it down.                                                                               |
| Name    | The person's name. Apply sets it from the first and last name of the application each time they are saved; the Create organization page sets it from the account's name.                                               |
| Switch  | Before any of its applications is submitted, Apply step 1 changes it: to a team (the same record becomes a `builder_team`, in review like any team) or to a company (the person leaves it to join or add the company). |
| Members | Only its owner: no invitations, join requests or join by domain, and it is not found by organization search.                                                                                                           |
| Public  | No organization page; it is not offered where organizations are listed or picked. Its listed solutions show its name without a link.                                                                                   |
| Words   | It reads "Individual" wherever a type is named; no team size is shown.                                                                                                                                                 |

## Decisions

1. **The type marks the person, no new column.** Every way of making an `independent_builder` already means "a builder on their own": the Lovable import maps "Just me" and "Self Employed" to it, the Create organization page asks it only for a name and a country. A separate flag would let the two disagree.
2. **Approved at once instead of hidden from the queue.** Listing a solution, starting a conversation and appearing beside a solution all ask for an approved organization. Leaving it in review and filtering it out of the queue would have kept the person blocked from those; approving it at once lets the solution review carry the check, which is where something public appears. Existing ones in review or sent back are approved by the migration; refused and taken-down ones keep the operator's decision.
3. **A company switch leaves the record behind.** The person leaves their one-person organization, which keeps no member and is shown nowhere. Moving drafts to a company the person may only have asked to join is not possible; the solution draft stays with the left record and is written again for the company, which the step says. A switch is refused once an application of it was submitted, or once one of its solutions is in review or listed: by then someone has seen it under that name.
4. **No public page for a person.** The brief does not require personal publishing (line 56), and the talent profile is where a person presents themselves.

## Changes

Backend, `organization`:

- `createOwned` makes an `independent_builder` approved, without industries; the Create organization page names it after the account.
- `invite`, `join`, `letDomainJoin`, the operator's approval and save with a domain refuse an `independent_builder` with `ORGANIZATION_INDIVIDUAL` (409). `save` and `saveBasics` refuse an individual, and a change to its type, with the same code: approved without review, it may only carry the name the person gives on their application, and the switch is Apply's. A switch is refused too for an individual GenAI Fund refused or took down, so that neither a team nor a fresh start undoes that decision.
- `search`, `approvedAt`, `approvedOrganization`, `approvedOrganizations` and `publicPage` leave it out; `suggestedDomain` gives none.
- `OrganizationService.renameIndividual` and `becomeTeam` and `leaveIndividual`, called by `proposal`.
- `V95__organization_individuals_approved.sql`: approves the ones in review or sent back, clears their domain and auto-join, revokes their open invitations and declines the open requests to join them.

Backend, `proposal`:

- `save` renames the applicant's `independent_builder` after the contact's name.
- `organize` accepts a caller whose organization is a switchable `independent_builder` and turns it into the team; `POST /api/proposal/programs/{slug}/application/organization/leave` lets them leave it for a company. Both refuse with `PROPOSAL_INDIVIDUAL_LOCKED` (409) once it is not switchable.

Backend, `solution` and `usecase`: the public solution records give `organizationSlug` null for an individual; a use case is refused for one.

Web:

- Apply step 1: "Individual · name" without the review badge and hint, and a **Change** action while switchable.
- The account menu reads **My solutions**; the organization frame shows an individual its solutions only, without the review notice and the profile, members and use cases tabs.
- The organization type vocabulary reads "Individual"; no team size row in the submitted record.
- Solution card and page show the organization's name without a link when it has no slug.

## Failures

- `ORGANIZATION_INDIVIDUAL` (409): an invitation, join, domain or type change on an individual.
- `PROPOSAL_INDIVIDUAL_LOCKED` (409): a switch after an application of the individual was submitted or its solution was sent for review or listed.
