# Organization: verification matrix

Boundaries follow [conventions › Testing](../conventions.md#testing). Membership is rows in four tables read on every request, so `OrganizationTest` starts the full application against PostgreSQL and speaks real HTTP, signing in through the emailed code as the identity tests do.

`OrganizationTest` is written and has not been run yet ([plan, step 7](../increments/active/bey-33-organization-solution-talent/plan.md)).

| Contract                                                                                                        | Regression it catches                                                            |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| A person creates an organization, becomes its owner, and it waits for review                                    | An organization visible before GenAI Fund saw it; a creator who is not its owner |
| A new organization carries its industries, and its creator's job title is on their membership                   | Industries dropped on the way in; an owner without the title they gave           |
| A creation without a country, a team size, an industry or a job title answers `400` and points at each          | An organization in review that lacks what the review reads                       |
| A person belongs to one organization: creating, joining or accepting a second one is refused                    | Two memberships for one account                                                  |
| A matching email domain joins at once when auto-join is on, and asks when it is off; another domain always asks | Anyone joining any organization; a colleague blocked from their own company      |
| An owner invites by email; only that address sees, accepts or declines the invitation; an owner can withdraw it | An invitation accepted by another account; an invitation that cannot be undone   |
| An owner approves or declines a request to join; a member cannot                                                | A member admitting people                                                        |
| An owner changes a role and removes a member; the last owner cannot leave or be demoted                         | An organization without an owner                                                 |
| A stale `version` on save answers `409`                                                                         | Two owners overwriting each other's profile                                      |
| An operator approves, or refuses with a reason; saving a refused organization sends it for review again         | A refusal the owners cannot answer; a refused organization that stays refused    |
| A claim on an organization nobody owns is decided by an operator; approval makes the claimant its owner         | Anyone taking over an unowned organization                                       |
| An operator adds an organization that is approved at once, with an owner invited or none                        | A company GenAI Fund lists that must wait for its own review                     |
| Every operator decision and every change of role or removal is in the audit log                                 | A decision nobody can trace                                                      |
| The admin paths answer `403` to a user and `401` without a session                                              | The review screens open to everyone                                              |
| Anyone reads the page of an approved organization; one that waits or was refused answers not found              | A company page behind sign-in; an unreviewed organization shown to the public    |
