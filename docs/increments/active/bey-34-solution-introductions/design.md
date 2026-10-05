# Introduction requests on a solution

A person who finds a solution in the directory asks GenAI Fund to introduce them to the provider behind it. Neither side sees the other's email address until the provider answers. Tracked in Linear as BEY-34.

The decision behind it is [BEY-27, decision 9](../bey-27-main-flows-design/design.md): "Introductions go through GenAI Fund." This increment decides how, and builds it. The screens are the rows 4 and 5 of the section "AI solutions — list and detail" in `BeyondPilot — Product UI`.

## What a person can do

- **Ask for an introduction.** A signed-in person who belongs to an organization opens a listed solution and chooses "Request an introduction". The dialog names the organization they ask as and takes a message of up to 2000 characters. The solution page then says the request was sent.
- **Wait for the answer.** At most one request from a person to a solution waits at a time. A new one can be sent once the provider has answered the earlier one.
- **Hear of it as the provider.** The owners of the provider organization get an email with the sender's name, their organization and the message, and no address. It tells them to sign in and answer under My organization › Introductions.
- **Answer.** An owner of the provider opens the list of requests and replies or declines. Members of the organization may read the list.
- **Be introduced.** On a reply, both people get an email with the other's name and address, and the request is marked replied. On a decline, the sender gets an email that the provider will not take it further, with no address.

## Boundary discovery

| Question                       | `introduction`                                                                                                                                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What does it own?              | Introduction requests and their answer                                                                                                                                                                            |
| Who changes its data?          | A signed-in member of an approved organization sends; the owners of the provider answer                                                                                                                           |
| What does it need from others? | `solution` (the listed solution at an address and the organization behind it), `organization` (the caller's membership, the owners of an organization), `identity` (names and addresses), `notification`, `audit` |
| What do others need from it?   | Nothing yet                                                                                                                                                                                                       |
| Why not part of `solution`?    | A request has its own lifecycle and its own readers. Putting it in `solution` would add `notification` to that module's dependencies for one feature                                                              |

The dependency edges are new: `introduction → audit, identity, notification, organization, solution`. None points back. `organization` gains `ownersOf(organizationId)` and `solution` gains `listedAt(slug)`, each returning the little the new module needs, as `OrganizationName` already does. `ModulithArchitectureTest` lists the module.

## Decisions

1. **The provider answers inside the application.** An email address is revealed only by an answer, and the answer is a button in the workspace, so the address never travels before the provider chose to share it. The alternatives were a message sent straight to the provider, as a talent profile does, which reveals the sender at once, and an operator who connects the two by hand, which needs an admin screen and daily work.
2. **A request needs an organization.** The dialog names who is asking, and the provider reads that name. A person without an organization is told to create or join one first; they are not offered a form that cannot be sent.
3. **The recipients are the provider's owners.** A member is not a recipient: owners decide for the organization, as they do for its solutions.
4. **One waiting request per person and solution.** It stops repeated mail to the same owners and needs no clock. It replaces the one-a-day rule of the talent messages, which suits a person writing to one person.
5. **An email carries no link that acts.** As the invitation email, it tells the owner to sign in and answer. Its language is not known, so it is written in both English and Vietnamese.
6. **A decision is final.** A replied or declined request cannot change; the sender may send another.
7. **The sender's organization is the one they belong to.** `organization_member.account_id` is unique, so the request records it from the membership, never from the body.
8. **Failures are typed.** `IntroductionErrorCode` carries each refusal; the web maps the code to a message in both languages.

## HTTP

| Path                                                | Use                                                             |
| --------------------------------------------------- | --------------------------------------------------------------- |
| `POST /api/introduction/introductions`              | Ask for an introduction: the solution's address and the message |
| `GET /api/introduction/mine/received`               | The requests to the caller's organization, newest first         |
| `POST /api/introduction/mine/received/{id}/reply`   | An owner answers and both sides learn each other's address      |
| `POST /api/introduction/mine/received/{id}/decline` | An owner declines                                               |

The exact contract is `openapi.yml`.

## Web

| Where                                   | What                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------- |
| `/solutions/[slug]`                     | The button, the dialog and the "request sent" state, as drawn in rows 4 and 5         |
| `/workspace/organization/introductions` | The provider's requests with Reply and Decline; a tab beside Solutions for a provider |

Every visible string is in both `messages/en.json` and `messages/vi.json`, and every refusal is shown by its code ([internationalization](../../../conventions.md#internationalization)). The screens follow the Figma frames; where the frames draw more than the API holds, the screen shows the empty state or leaves the element out.

## Data

- `introduction_request`: the solution, the provider organization, the sender's account and organization, the message, the state (`pending`, `replied`, `declined`), when it was sent and when and by whom it was answered. Added by the next free migration after `V9`.

## Known limits

- Operators see none of it; the admin screens come later.
- There is no in-application notice: the owner learns of a request by email and by opening the list.
- The Figma frames do not draw the owners' list of requests; it is built from the Solutions tab of the same page.
- A request names a solution, not a person at the provider.
