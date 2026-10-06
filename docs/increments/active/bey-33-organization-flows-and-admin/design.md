# Organization: the flows completed, and what operators manage

The first organization increment ([design](../bey-33-organization-solution-talent/design.md)) let a person get into an organization and let an operator review a new one. This one closes what it left open: who vouches for an email domain, how many people an owner may invite, what a person who was declined sees, and what an operator can do to an organization after its review. Tracked in Linear under BEY-33 as three issues, one per slice: BEY-61, BEY-62 and BEY-63.

The screens are the sections `Organisations — admin` and `Organisations — workspace` of the page `Screens` in `BeyondPilot — Product UI`, each drawn at 1440, 1024 and 390.

## What changes for a person

- **A domain is verified by GenAI Fund, not asserted by an address.** Creating an organization no longer takes the domain of its creator's address. An operator sets the domain when approving a new organization, when approving a claim, or later on the record. Only a verified domain lets addresses on it join.
- **Joining at once is off until an owner turns it on.** It can be turned on only for an approved organization with a verified domain.
- **A claim is always reviewed.** An address on the domain of an organization nobody owns no longer becomes its owner by asking; it sends a claim, and an operator decides it.
- **A person who asked hears the answer.** While a request or a claim waits, the person sees whom it is with and can withdraw it. A declined one shows that it was declined, by whom in kind (its owners, or GenAI Fund), and offers to ask again or to look elsewhere. Both decisions are emailed.
- **Invitations have limits.** Only an approved organization invites. It sends at most 20 invitations in 24 hours and keeps at most 50 open. The Members page says how many are left, and the dialog says which limit was reached.
- **Leaving asks first** (slice 2). The last owner is told to make someone else an owner before leaving.
- **A taken-down organization keeps its workspace** (slice 2). Its members read why; it lists nothing publicly, invites nobody and cannot write solutions until it is restored.
- **A merged organization leads to the one that was kept** (slice 3). Its members arrive there as members and are told once; its public address redirects.

## What an operator can do

| Capability                                                                   | Slice |
| ---------------------------------------------------------------------------- | ----- |
| Review a new organization in a dialog and verify its email domain there      | 1     |
| Decide a claim in a dialog, from the list, and verify the domain there       | 1     |
| See who asked and when in the list; a claim counts as waiting                | 1     |
| Take an approved organization down with a reason, and restore it             | 2     |
| Edit the profile and the verified domain of any organization                 | 2     |
| Change a member's role, remove a member, invite an owner or a member, revoke | 2     |
| Merge a duplicate into the organization to keep                              | 3     |

An operator may leave an organization without an owner: that is how a page is handed to someone else. Operators' invitations do not count against an organization's limits.

## Decisions

1. **Operators verify domains.** A self-asserted domain proved only that someone has an address there, not that they act for the company; it let the first colleague to sign in own a page an operator had prepared for someone else. This replaces two points of the decision of 3 October on BEY-33. The review dialog proposes a domain so the operator only confirms it: the creator's work domain for a new organization, the website's host for a claim, and nothing when another organization holds it or it is a public mail service.
2. **Existing domains are cleared.** `V10` sets every `email_domain` to null and turns `auto_join` off, because none of them was verified by an operator in the new sense. No environment holds organizations that people rely on yet.
3. **A request remembers whether it was a claim.** Until now "claim" was derived when read, from whether the organization had an owner at that moment, so a request could change kind after it was sent. `organization_join_request.claim` is written with the request.
4. **A declined answer is the person's latest request.** `mine` returns the caller's most recent request when it was declined and nothing newer replaced it. There is no "seen" flag: the declined page offers the finder, and asking again or joining anywhere replaces the answer.
5. **Limits are counted, not stored.** The daily limit counts the invitations an organization's owners created in the last 24 hours, revoked ones included, so revoking does not give the count back. The open limit counts invitations still pending. Both are constants of the module; there is no setting for them.
6. **Approving takes a body.** `approve` for an organization and for a claim accept `{ "emailDomain": string | null }`. A domain another organization holds answers `409 ORGANIZATION_DOMAIN_TAKEN` and nothing is decided.
7. **Take-down is a status, not a rejection** (slice 2). `suspended` keeps the approval facts and adds a reason from a closed list and a note; restoring returns to `approved`. Other modules ask `Membership.approved`, which is false while suspended, so `solution` needs no new rule to stop writes; its public reads filter on the organization being approved.
8. **A merge keeps the record** (slice 3). The duplicate becomes `merged` with `merged_into`; its slug answers with the kept organization's slug so the web redirects. `organization` publishes `OrganizationMerged`; `solution` moves its rows in a listener within the same transaction. No dependency edge is added.
9. **Shortcuts live in search only.** `/` focuses the search field of a list, as `FilterToolbar` already does; a dialog has no shortcut. The A, S and N keys of the solution and talent review pages are outside this increment.
10. **Pastel status colours are tokens.** Five tints (`lemon`, `sky`, `mint`, `peach`, `rose`) with their foregrounds join `tokens.css`. `Status` gains a `pill` appearance that the organization lists use; the owner and member roles and the avatar initials take a tint. Other screens keep their look until they are redrawn.

## Data

`V26__organization_verify_domains_and_limit_invitations.sql` (slice 1):

- `organization.email_domain` cleared, `auto_join` false for every row and by default.
- `organization_join_request.claim boolean not null default false`, set for the open requests of organizations without an owner.
- `organization_invitation.sent_by_operator boolean not null default false`, so an operator's invitation stays out of the organization's limits.
- An index on `organization_invitation (organization_id, created_at)` for the daily count.

`V27__organization_add_founded_year_and_logo.sql` (slice 1): `organization.founded_year integer` between 1800 and 2100, and `organization.logo_url text`. Both are null for an organization made before; its owner fills them in the next time the profile is saved.

`V28__organization_drop_roles.sql` (slice 1): drops `organization.roles` and its check constraint.

Slice 2 adds `suspended` to the status check with `suspension_reason`, `suspension_message` and `suspended_at` in `V30`. Slice 3 adds `merged` and `merged_into_id` in `V14`.

## HTTP

Slice 1 changes, all under `/api/organization`:

| Path                                     | Change                                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `GET /mine`                              | `request` carries the organization's type, country and domain; `declined` is the declined answer   |
| `GET /mine/members`                      | `allowance` for an owner: whether inviting is open, and how many invitations are left today / open; `?page=` reads ten members at a time with `page`, `pageSize` and `total`, while invitations and requests stay whole |
| `POST /mine/invitations`                 | `409 ORGANIZATION_NOT_APPROVED`; `429 ORGANIZATION_INVITATION_DAILY_LIMIT` and `…_OPEN_LIMIT`      |
| `PUT /mine/auto-join`                    | `409 ORGANIZATION_DOMAIN_NOT_VERIFIED` when turned on without an approved, verified domain         |
| `POST /organizations/{id}/join`          | The outcome `owner` is gone; an unowned organization always answers `requested`                    |
| `GET /admin/organizations`               | Each row says what waits (`request`: `new`, `claim` or none), who asked and when                   |
| `GET /admin/organizations/{id}`          | `suggestedDomain`                                                                                  |
| `POST /admin/organizations/{id}/approve` | Body with `emailDomain`                                                                            |
| `POST /admin/claims/{id}/approve`        | Body with `emailDomain`                                                                            |

The exact contract is `openapi.yml`, refreshed with each slice.

## Web

- **Entry.** `OrganizationEntry` gains the declined state beside the waiting one; both name the organization with its type and country. The finder no longer offers "join as owner".
- **Members.** The count line says what is left today; the invite button opens the limit dialog instead of the form when a limit is reached, and is absent while the organization waits for review. "Who can join" names the domain as verified by GenAI Fund, and offers the switch only when there is one.
- **Admin list.** Columns Organisation, Request, Status, Asked by, Received. A waiting row opens the review dialog, which holds the domain field; a claim row opens the claim dialog. Status is a pastel pill.
- **The profile form asks what the mockup of Kai asks.** A creation and a save require the website, the short description (at most 280 characters), the year founded, the country, the team size and at least one industry; the logo address is optional. The creation button reads "Submit for approval". The form has no role (provider, enterprise), as the mockup has none: every approved organization lists solutions, and will submit use cases when BEY-35 exists, so an owner has nothing to choose. The industries are searched and chosen from the fixed list in a combobox (at most five), because the solution directory filters on those codes. `Membership` carries `owner` and `approved` only. Every member of an organization writes its solutions, whether or not it is approved yet, and review decides what is listed (BEY-37); the solution error `SOLUTION_PROVIDER_REQUIRED` became `SOLUTION_MEMBER_REQUIRED`.
- **Fixes.** "Clear search and filter" clears every parameter in one update in the six toolbars that use it, and the three admin specs stop reloading the page to work around it. Admin home counts waiting customer deployments.

## Known limits

- An invitation does not expire; the frames draw an expiry date, which is left out.
- "Ask to change the domain" is left out: an owner writes to GenAI Fund by email, as for anything else.
- The logo is an address the owner writes; it is not uploaded, and the screens still draw initials until a screen that shows the logo reads it. A year in the future is accepted up to 2100.
- What the mockup's "Complete your account" step asks (first and last name, phone, country, LinkedIn, photo) belongs to `identity` and is not in this increment.
- The Use cases tab of an enterprise waits for the use case module (BEY-35). When it exists, an owner drafts and submits and members read.
- The daily limit is a rolling 24 hours, while the screen says "today".
