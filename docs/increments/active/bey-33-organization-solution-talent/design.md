# Organizations, the solution catalog and talent profiles

Three modules that the directory of BeyondPilot stands on: who a company or team is and who belongs to it, what an AI provider offers, and who can be hired. GenAI Fund reviews each of the three before others see it. Tracked in Linear as BEY-33; the solution and talent modules were built on the same branch.

The domain behind it is [BEY-22 — Phase 1 domain model](../bey-22-phase-1-domain-model/design.md); the screens follow the drafts of [BEY-27](../bey-27-main-flows-design/design.md).

## What a person can do

- **Get into an organization.** A signed-in person without one sees the invitations sent to their address, the organization of their email domain, a search by name, and a form to create a new one. Joining is immediate when the email domain matches and the organization allows it; otherwise the person asks and an owner decides. An organization nobody owns can be claimed, and an operator decides the claim. Where a domain comes from, what a claim and a declined request do next, and how many invitations an organization sends are replaced by [the flows completed](../bey-33-organization-flows-and-admin/design.md).
- **Run an organization.** Its owners edit the profile, invite people by email as owner or member, approve or decline requests to join, change roles and remove members. Anyone can leave; the last owner cannot. Each member records their own job title.
- **Say what an organization is.** Its profile holds a name, what it does here, a type, a country, a team size and one to five industries from the list the solutions are filed under; a website and a description are optional. The person who creates it also says their own role or job title, which is recorded on their membership. An organization an operator adds for a company that is not here yet has no team size and no industries until an owner saves its profile.
- **Say what the organization is.** An organization is a provider, an enterprise, or both. The owner chooses; the role decides which tabs the organization has. Only a provider has Solutions.
- **List a solution.** An owner of an approved provider starts a solution from its name, fills it in as a draft and sends it for review. Members read. A rejected solution carries the reason and can be sent again. An approved solution is in the public directory while `listed` is on, and a change to it shows at once.
- **Publish a talent profile.** Any signed-in person keeps one profile: headline, bio, roles, skills, availability, engagement, rate band, up to six projects. It is reviewed like a solution.
- **Write to a person.** A signed-in visitor sends a message through a profile. The person gets it by email with the sender's name and address and answers there; the profile never shows an email address. One message per sender per profile per day.
- **Review, as an operator.** Under `/admin`: organizations (approve, refuse with a reason, decide a claim, add an organization that is approved at once), solutions and talent profiles (approve, send back with a reason, take an approved one down). Each decision is in the audit log.
- **Browse, as anyone.** `/solutions` and `/talent` list what is approved and listed, narrowed by search and facets; each entry has its own page.

## Boundary discovery

| Question                       | `organization`                                                                                | `solution`                                                                                       | `talent`                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| What does it own?              | Organizations, membership, invitations, requests to join and claims                           | Solutions and their review state                                                                 | Talent profiles, their projects, the messages sent to them |
| Who changes its data?          | Members and owners; operators for review and claims                                           | Owners of an approved provider; operators for review                                             | The person; operators for review; a signed-in sender       |
| What does it need from others? | `identity` (the caller, an account's name and address), `notification`, `audit`               | `organization` (membership, role and approval of the caller's organization), `identity`, `audit` | `identity`, `notification`, `audit`                        |
| What do others need from it?   | `Membership`: the caller's organization, their role in it, whether it is an approved provider | Nothing yet                                                                                      | Nothing yet                                                |
| Why not one module?            | Membership rules change for reasons a catalog does not                                        | A solution belongs to an organization; its review is its own lifecycle                           | A profile belongs to a person, not to an organization      |

The dependency edges are new: `organization → audit, identity, notification`; `solution → audit, identity, organization`; `talent → audit, identity, notification`. None points back, and `ModulithArchitectureTest` lists the three modules.

## Decisions

1. **One organization per person.** `organization_member.account_id` is unique. A person who works for two companies uses two addresses. It keeps "my organization" unambiguous in every other module; lifting it later is a migration of one constraint and of `Membership`.
2. **The owner chooses the roles.** `organization.roles` is a set drawn from `provider` and `enterprise`, validated in the request and by a check constraint. The review by GenAI Fund is what keeps the choice honest. This awaits the client's confirmation; an operator-assigned role would move one field from the profile form to the admin screen.
3. **Review states are per record.** An organization is `pending`, `approved` or `rejected`; a solution and a profile add `draft` and `submitted` because their owners work on them before asking. A refusal stores a reason from a closed list and an optional note the owner reads.
4. **Saving an organization that was refused sends it for review again.** There is no separate resubmit action: the owner's correction is the request.
5. **A change to an approved solution or profile is public at once.** Operators can take either down, which is a rejection with a reason. A second review for every edit would stall small corrections.
6. **Optimistic locking on every edited record.** The form sends the `version` it loaded; a stale save answers `409` with `…_CHANGED_MEANWHILE`.
7. **Slugs are generated once** from the name, made unique with a numeric suffix, and do not change when the name does, so a public address keeps working.
8. **Codes, not free text, for every facet** (industry, focus area, maturity, deployment, talent role, availability, engagement, rate band). The backend validates them; the web names them from `Vocabulary` in the message catalog, in both languages.
9. **A talent project carries a year, not a date.** People remember the year, and nothing sorts within one.
10. **The enquiry is stored and emailed.** The stored copy is the person's inbox on their profile page; the email is how they learn of it.
11. **Forms hold their state in React.** The convention names TanStack Form with Zod; neither is installed, and the existing sign-in form holds state the same way. Validation that matters is the backend's; the forms repeat the required-field checks so a person hears of them before a round trip.
12. **Country names are in the message catalog.** `Intl.DisplayNames` answers differently in Node and in the browser for some regions, which breaks hydration.

## HTTP

| Area         | Paths                                                                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organization | `/api/organization/mine` and its members, invitations, requests, job title and auto-join; `/api/organization/organizations` (search, create, join); `/api/organization/admin/organizations` |
| Solution     | `/api/solution/mine`, `/api/solution/mine/{id}`, `…/submit`; `/api/solution/solutions`, `/api/solution/solutions/{slug}` (public); `/api/solution/admin/solutions`                          |
| Talent       | `/api/talent/mine`, `/api/talent/mine/submit`; `/api/talent/profiles`, `/api/talent/profiles/{slug}` (public), `…/enquiries`; `/api/talent/admin/profiles`                                  |

`SecurityConfiguration` opens only the public `GET` paths: the two directories with their pages, and the page of an approved organization (`/api/organization/organizations/{slug}`). The exact contract is `openapi.yml`.

## Web

| Route                                                          | Screen                                                               |
| -------------------------------------------------------------- | -------------------------------------------------------------------- |
| `/workspace/organization`, `/workspace/organization/new`       | The ways in and the form of a new one, or the organization's profile |
| `/workspace/organization/members`                              | Members, requests, invitations, the caller's job title and auto-join |
| `/workspace/organization/solutions`, `…/solutions/[id]`        | The organization's solutions and the editor of one                   |
| `/workspace/talent`                                            | The caller's talent profile and the messages sent through it         |
| `/solutions`, `/solutions/[slug]`, `/talent`, `/talent/[slug]` | The public directories and their pages                               |
| `/organizations/[slug]`                                        | The public page of an approved organization                          |
| `/admin/organizations`, `/admin/solutions`, `/admin/talent`    | The operators' lists and review pages                                |

`features/solution` imports `features/organization` for the organization frame; nothing imports the other way. The shared pieces are composites: `FilterToolbar`, `ListFooter`, `ReviewStatus`, `ReviewReadiness`, `LeaveGuard`, `QueueNext`, `ReasonDialog`, `ChoiceChips`, `CodeList`, `DirectorySearch`.

- **The screens follow the Figma frames.** The public directories and pages, the organization workspace, the ways into an organization and the operators' Organisations list are built from the frames of the page `Screens` in `BeyondPilot — Product UI`. Where a frame shows what the API does not hold, the screen shows the empty state the frame draws, or leaves the element out ([known limits](#known-limits)); it shows no sample content.
- **The workspace sits under the site header.** An organization's pages share a head with its name and the tabs Profile, Members and Solutions, each with its count. A person without an organization sees the ways in on a page without the site navigation. The talent profile is reached from the account menu.
- **A directory pages by number.** The frames draw "Load more"; the lists keep page links, as every list does ([lists](../../../conventions.md#lists)), in the footer the operators' tables use. A select beside the count orders the list: the most recently approved first, or by name.
- **"By …" leads to the organization.** `/organizations/[slug]` is the public page of an approved organization: who it is, its facts beside, the solutions it lists and the customer deployments behind them. It shows four solutions and loads more on request.
- **A customer deployment is a reviewed claim.** An owner tells of a project in which a customer put a solution to work: a title, the customer as it may be published (a name, or a description that does not name it), the problem, what was deployed, its stage and, when published, channels, languages, period and result. It waits for an operator from the moment it is written and again after every change, because it is a claim about a third party; only an approved one shows on the solution, its card and the organization's page. A solution lists at most 12. Left for later: who delivered it (the link to talent profiles), the customer's own confirmation, and the requests for a similar project or a customer reference.
- **What a review needs is said before it is asked for.** Above the buttons of the solution and talent editors, `ReviewReadiness` lists the fields still to fill in, each a way to its field, and says what GenAI Fund checks. A refused attempt moves focus to the first field it lacks.
- **A form knows when it differs from what was saved.** The two editors and the organization profile save only after a change, then offer Discard, which asks first, and say so beside the buttons. `LeaveGuard` asks before an in-app link or the browser leaves the page with changes unsaved.
- **A refusal has no default reason.** `ReasonDialog` starts without one, and the decision cannot be sent until the operator chooses.
- **An organization is reviewed from its list.** A row of the operators' list opens the review in a dialog, and the refusal asks for its reason in a second one. Members, invitations and claims stay on the record's page.
- **A queue of solutions or profiles is walked from its records.** A record's admin page says where it stands among those that wait and links the next one (`QueueNext`). A decision on a waiting record opens the next, and after the last one the list, which then says nothing waits. On that page A approves, S opens the refusal and N goes on (`useShortcuts`); a key acts once, and not while a field has focus, a dialog is open, a decision is on its way or the page has been shown for less than a second, so a repeated press never decides the next record unread. A waiting row of the list says how long ago it was sent.
- **Admin home is the queue.** `/admin` counts what waits for a decision in the three lists, and each count opens its list already narrowed.

## Data

- `V5__organization_create_organizations.sql`: `organization`, `organization_member`, `organization_invitation`, `organization_join_request`.
- `V6__solution_create_solutions.sql`: `solution`.
- `V9__organization_add_industries.sql`: `organization.industries`, empty for the rows that exist.
- `V7__talent_create_profiles.sql`: `talent_profile`, `talent_project`, `talent_enquiry`.

V4 is left to the program module, which is built on another branch.

## Known limits

- An organization's public page shows no team or programmes, and there is no logo yet; a solution and a profile have no images. Initials stand in their place.
- The frames draw more than the API holds. Left out until it does: on a solution, proof items other than customer deployments, the programme line, offers, channels, languages, the request for an introduction and the sort by proof; on a profile, the organization the person works at, the stage and confirmation of a project, industries, languages, the programme block, the country filter and the sort; on an organization, industries, the year founded, a second domain, who last edited a solution and when an invitation expires.
- An enterprise's Use cases tab waits for the use case module.
- Search is `ILIKE` over a few columns; it has no ranking.
- A member invited by email must sign in with that address; there is no invitation link.
- The enquiry limit is per sender and profile, not per sender overall.
- A public solution page has no evidence section and no enquiry; a solution's only action is its website.
- An operator decides one record at a time: there is no decision from a list row and none for several records at once, and an approval is undone only by taking the record down.
- The browser's Back button leaves a changed form without asking.
