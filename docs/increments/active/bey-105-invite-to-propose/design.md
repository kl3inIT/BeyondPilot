# BEY-105 — Matching: invite a recommended provider to propose

Status: proposed on 14 October 2026. Nothing is built.

## What it does

The brief asks for it twice: a use case's owner should "receive relevant solution recommendations promptly after submission, with an **invitation-to-propose action**" (§7.4), and the enterprise journey runs "receive relevant solution recommendations → **invite providers to propose** → review incoming proposals → shortlist" (§6).

Every step of that journey exists except the invitation:

| Step                                                                                        | Where it is                                                                                                                          |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Recommendations                                                                             | Matching ([BEY-39](../../completed/bey-39-matching/design.md)), read one at a time ([BEY-176](../../completed/bey-176-matching-review/design.md)) or as a list |
| A provider sends a proposal to a use case                                                   | `proposal` ([BEY-133](../bey-133-use-case-proposals/design.md)): any organization, approved or still in review                       |
| The use case's organization reads, shortlists and declines proposals, and tells the senders | `proposal`, BEY-133's decisions and outcomes, merged on 14 October                                                                   |
| **Invite a recommended provider to propose**                                                | Missing                                                                                                                              |

So the invitation is an email that leads a provider to a step that already works. It adds no new way to propose.

## Domain story

1. Lan, of Tasco, reads the matched solutions of her use case. Papaya is a strong fit. She chooses **Invite to propose**.
2. A dialog says who will be emailed ("the 2 owners of Papaya") and shows the message. Lan may add a few words. She sends.
3. Papaya's owners get an email: Tasco invites Papaya to propose for "AI for Insurance: Scaling Compulsory Motor Insurance Renewal", with the use case's closing date and a link to it.
4. The card and the row of Papaya now say **Invited**, with when and by whom.
5. Juin, an owner of Papaya, follows the link, reads the use case and chooses Send a proposal: BEY-133's flow, unchanged.
6. Once Papaya's proposal is sent, its card and row say **Proposal received**, and Lan reads it among the proposals of the use case.

The same holds for an organization imported from the old platform that nobody has claimed: the email goes to the address GenAI Fund invited to own it (BEY-147). Signing in with that address shows the invitation to own the organization, and from there the proposal.

Failure paths: the provider has neither an owner nor an open invitation to own it (nobody to email: the action says so and is not offered); the use case has closed (refused); the provider was invited already for this use case (the action reads Invited; nothing is sent twice); the day's limit is reached (refused, with when it resets); the email fails (the invitation stands, and the email is retried as every email is).

## Who does what

| Action                                | Member of the use case's organization | Operator |
| ------------------------------------- | ------------------------------------- | -------- |
| Invite a recommended provider         | Yes, within the day's limit           | Yes      |
| See who was invited, when and by whom | Yes                                   | Yes      |
| Withdraw an invitation                | No: an email cannot be taken back     | No       |

The provider learns from the email which organization invites it and for which use case: both are on the use case's public page already.

## Decisions proposed

| Decision                                                                                                          | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| An email, not a first message in Messages (BEY-173)                                                               | Weighed on 14 October at Đạt's question. The brief names an invitation-to-propose action and counts outcomes among the essential emails (§7.10); it asks for no chat, and warns against assuming marketplace features. Messages refuses an organization with no member, which is nearly every imported provider, and its email carries no text, so a provider would sign in before knowing what it is invited to. The provider can still write back through Contact on its solution's page |
| The invitation lives in `matching`, beside the decisions on a candidate                                           | It is something a person does to a recommended solution, as saving it is. `proposal` stays as it is, so BEY-133's module does not change                                                                                                                                                                                                                                                                                                                                                   |
| `matching` gains the allowed dependency `notification`                                                            | To send the email, as `proposal` and `messaging` do. A new edge between modules is an architecture decision ([change design](../../../conventions.md#change-design))                                                                                                                                                                                                                                                                                                                       |
| One invitation per use case and provider organization, ever                                                       | A second email to the same people about the same use case is noise. Several solutions of one organization are one invitation                                                                                                                                                                                                                                                                                                                                                               |
| The recipients are the provider's owners; with none, the addresses GenAI Fund invited to own it                   | Decided by Đạt on 13 October: the imported providers are reached through the invitations to own them. Owners decide for an organization in BEY-173 too                                                                                                                                                                                                                                                                                                                                     |
| A member sends at most 10 invitations a day for one use case; operators are not limited                           | The email reaches real companies. Ten a day covers a strong-fit group; an operator acting for GenAI Fund answers for what it sends                                                                                                                                                                                                                                                                                                                                                         |
| The use case must be approved and open, and the candidate must not be removed                                     | An invitation to a use case that cannot take proposals leads nowhere                                                                                                                                                                                                                                                                                                                                                                                                                       |
| The person who invites may add a note of up to 500 characters                                                     | It is the one place a person speaks to the provider before a proposal                                                                                                                                                                                                                                                                                                                                                                                                                      |
| No Undo; the dialog says who will be emailed before sending                                                       | [Actions](../../../conventions.md#actions): an action that emails someone asks once, naming who, and has no Undo                                                                                                                                                                                                                                                                                                                                                                           |
| "Proposal received" is read from `proposal`'s list of the use case's proposals, joined in the web by organization | `matching` does not depend on `proposal`; the page already reads the proposals' count for its tab                                                                                                                                                                                                                                                                                                                                                                                          |
| A new editable email kind, `matching_invitation`, in the use cases group                                          | Operators edit every email's words in Admin › Email › Templates                                                                                                                                                                                                                                                                                                                                                                                                                            |

## What changes

### Backend

- `V95__matching_create_invitations.sql`: `matching_invitation (id, use_case_id, organization_id, candidate_id, note, account_id, by_operator, created_at)`, unique on `(use_case_id, organization_id)`.
- `MatchingService.invite(actor, candidateId, note)`: checks, records, emails, audits (`matching.candidate_invite`).
- `organization`: `OrganizationDirectory.invitedOwners`, the addresses of the open invitations to own an organization, for one with no owner.
- `notification`: `EmailKind.MATCHING_INVITATION`, its English template (emails are in English, as every other), `EmailService.sendMatchingInvitation`.
- `MatchingResponse.Candidate` gains `invitedAt`, `invitedBy` and `invitedByOperator`; the response gains how many invitations the caller has left today. Whether a provider has anyone to email is not read for each candidate: it would need the organization of every solution from `solution`, a change to Việt's module for one flag. A provider with nobody to email is refused when invited, with the reason (`MATCHING_NOBODY_TO_INVITE`).
- `POST /api/matching/candidates/{id}/invite`; `openapi.yml` and the generated client.

### Web

- **Invite to propose** on the card of the one-by-one review, in the panel and in the row's menu of the list.
- The dialog: who is emailed, the message, the note, Send.
- **Invited** and **Proposal received** on the card and the row.

## Left out

- A banner on the use case page for an invited provider; the email leads there.
- Reminders, and inviting a provider that matching did not recommend (an operator adds it by hand first).
- Invitations through MCP.

## Open

- **Proposal received** on a card needs the received proposals to name the sending organization by identifier, or their solutions: `ReceivedUseCaseProposalSummary` carries the organization's name only. A field for Nhật's `proposal` module to add; until then a card reads Invited.
- **No count of invitations left** is shown: a limit against unwanted mail is not shown until it is reached, as in LinkedIn's invitations and in Messages (Đạt, 14 October). The action is not offered once the day's limit is reached.

- The limit of 10 a day: a number to confirm with GenAI Fund once it is in use.
- Whether the email names the person who invites, or only their organization. Proposed: the organization only, as BEY-173 shows the organization to a provider.

## References read

- Brief §6 and §7.4.
- BEY-133 design, with its decisions and outcomes follow-up; BEY-173 design (who answers for an organization, emails with no address in them).
- `OrganizationDirectory.ownersOf`; `organization_invitation` (V5).
