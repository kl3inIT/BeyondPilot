# AI talent: a project credited by the organization that delivered it

Tracked in Linear as BEY-67. It builds on [BEY-36](../bey-36-talent-enquiries-and-review/design.md) and replaces its [decision 12](../bey-36-talent-enquiries-and-review/design.md#decisions) (projects are only stated by the person) for projects delivered through an organization on BeyondPilot; a project the person describes alone stays as BEY-36 has it. It realises what [BEY-27, decision 7 and 7a](../bey-27-main-flows-design/design.md#decisions) draws: a profile names who confirmed each project, and a deployment names each person with their part. The screens are the section `AI talent — project credits (draft, BEY-67)` of `BeyondPilot — Product UI`. The product owner chose this direction on 6 October 2026; the decisions below are proposals until the screens are agreed.

## What a person can do

- **Link a project to a deployment, as the talent.** In the profile editor a project is either described by the person (as today) or linked to a customer deployment that GenAI Fund approved on BeyondPilot. A linked project takes its title, customer, stage and period from the deployment; the person writes their own part in it. Saving sends a credit request to the organization that owns the deployment's solution.
- **See where a request stands, as the talent.** The project shows Waiting for Relay Labs, Confirmed by Relay Labs on a date, or Not confirmed. Only a confirmed link is public.
- **Confirm or decline, as an owner of the organization.** Under the organization's workspace › Project credits, an owner reads who asks, their headline, the deployment and the part they state, and confirms or declines. A member reads the list and cannot act.
- **Withdraw a confirmation later, as an owner.** A confirmed credit can be removed, with an optional note; the project leaves the public profile and the team.
- **Read the proof, as a visitor.** A profile shows a confirmed project as "Confirmed by Relay Labs · 12 Mar 2026" with a link to the deployment; the deployment, on the solution page and the company page, lists its team: each confirmed person with their part and a link to their profile.

## Boundary discovery

| Question                       | Answer                                                                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What does it own?              | The credit: which project of which profile points at which deployment, the part the person states, and the request's state and decision. `talent` owns it, because the credit is a fact of a talent profile and lives and dies with it |
| Who changes it?                | The talent (link, edit the part, withdraw a request); an owner of the delivering organization (confirm, decline, remove)                                 |
| What does it need from others? | `solution` for an approved deployment by id, the deployments matching a search, and the organization behind each; `organization` for the actor's membership and the owners to email; `notification`, `audit`, `identity`, as today |
| Who needs it?                  | The public profile and directory (`talent`), and the team of a deployment, which the web page of a solution or a company reads from `talent`'s public API |

The new edge is `talent → solution`. `solution` depends on `audit`, `identity` and `organization`, none of which depends on `talent`, so no cycle forms. `solution` publishes one new record, `ApprovedDeployment(id, title, customer, stage, period, solutionName, solutionSlug, organizationId)`, and `SolutionDirectory` two reads: one deployment by id when it is approved, and the approved deployments among a set of ids. The deployment table stays `solution`'s alone; `talent` keeps the deployment's id, never a copy of its fields.

The alternative, `solution` owning the credit, would need `solution → talent` for the profile and would make a talent's projects live in two modules. It is rejected.

## Decisions

1. **The delivering organization confirms, not the customer.** The organization that owns the solution is on BeyondPilot and knows who worked on its deployment; the enterprise customer usually is not, and BEY-36 decision 12 still holds for it.
2. **Owners decide, members read.** As with introductions ([BEY-34](../bey-34-solution-introductions/design.md)): one owner's decision stands for the organization.
3. **Only an approved deployment can be linked.** GenAI Fund has already reviewed what the deployment claims; the credit adds only who took part.
4. **A linked project is public only once confirmed.** A request that waits, a declined one and a removed one are seen by the person alone. BeyondPilot never shows a tie to an organization that the organization did not confirm. The person can turn a declined project into one they describe themselves.
5. **The confirmation covers the deployment and the part.** Changing the part of a confirmed or waiting project sends a new request; editing anything else of the profile does not.
6. **A decline is final for that part.** The person may send again only after changing the part, and at most three requests per project, which stops pressure on the owners.
7. **The deployment decides what shows.** When the deployment is back in review after its owner edited it, or is deleted, the credit is not shown and the person reads why; a re-approved deployment brings it back. No copy of the deployment goes stale.
8. **Only an approved profile can ask.** The owner must be able to open the profile they confirm. A profile that is later hidden or removed drops out of the team with it.
9. **Emails without action links.** Each new request is emailed to the owners; each decision to the person, in both languages, as BEY-36 decision 1 does.
10. **Twenty requests wait at most per person.** The limit stops one account from asking every organization at once.
11. **The team is read from `talent`.** `GET /api/talent/deployments/{id}/team` returns the confirmed people of a deployment. The page of a solution or a company composes it under each deployment card; the `solution` feature in web does not import `talent`.

## HTTP

| Path                                                                | Use                                                                                       |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `GET /api/solution/deployments?q=`                                  | The approved deployments matching a search, for the picker; `q` is added to the existing list |
| `PUT /api/talent/profile`                                           | A project carries its `id` (kept across saves), and either its own facts or a `deploymentId` with a `part` |
| `GET /api/talent/organization/credits`                              | The credit requests of the actor's organization, waiting first                           |
| `POST /api/talent/organization/credits/{id}/confirm`                | An owner confirms                                                                          |
| `POST /api/talent/organization/credits/{id}/decline`                | An owner declines, with an optional note                                                  |
| `POST /api/talent/organization/credits/{id}/remove`                 | An owner removes a confirmed credit, with an optional note                                |
| `GET /api/talent/deployments/{id}/team`                             | The confirmed people of a deployment, public                                              |

## Web

| Route                                         | Change                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `/workspace/talent`                           | A project: Describe it, or Link a deployment (search, then your part); its credit state     |
| `/workspace/organization/credits`             | New: the requests, Confirm and Decline with a dialog, the confirmed ones with Remove        |
| `/talent/[slug]` and the directory card       | "Confirmed by …" with a link; the counts read confirmed projects                           |
| `/solutions/[slug]`, `/organizations/[slug]`  | The team under each deployment card                                                        |

## Data

`V18__talent_project_credits.sql`: `talent_project` gains `deployment_id`, `part`, `credit_status` (`requested`, `confirmed`, `declined`, `removed`), `credit_requests`, `credit_decided_at`, `credit_decided_by` and `credit_note`; `title` becomes nullable with a check that a project has a title or a deployment. Saving a profile updates projects by id instead of replacing them, so a credit keeps its project.

## Known limits

- A person who left the organization keeps a confirmed credit until an owner removes it.
- The enterprise customer still confirms nothing; a reference request to the customer stays as BEY-27 describes it.
