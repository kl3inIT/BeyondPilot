# Personal data consent

Every signed-in person agrees to how BeyondPilot uses their personal data before they use the platform, one purpose at a time, and can change each choice later in Settings. Tracked in Linear as BEY-240. GenAI Fund asked for it on 22 October 2026 to comply with Vietnam's Personal Data Protection Law (Law 91/2025/QH15) and Decree 356/2025/ND-CP; what the law asks and what the platform holds are in the [research note](../../../research/2026-10-22-personal-data-consent.md). GenAI Fund wrote the consent text the same day. The screens were decided on a clickable HTML prototype, built from the application's tokens and primitives, with the member who directs BEY-240.

Two parts are separate issues: anonymising a person's data when they ask for deletion (BEY-242), and the operators' screen of privacy requests with their deadlines (BEY-243).

## What a person can do

- **Agree after signing in.** A signed-in person who has not agreed to the current version of the required purpose is taken to `/consent` from any page. It says in one paragraph what they agree to and lists the four purposes with what each is (required, needed to apply, optional). **Accept all** turns on all four; **Choose one by one** opens the full text with one unticked box for each purpose. Agreeing returns them to the page they were going to. **Sign out** is the way out for someone who does not agree.
- **Read the full text.** The text GenAI Fund wrote, in a dialog: who we are, what data, why, who it is shared with, how long, the person's rights, and the four boxes.
- **Change a choice.** Settings (`/account`) gains a section "Privacy and consent": a switch for each purpose, the version and date agreed, the way to read the text again, and the address for other requests. Turning an optional purpose off or on takes effect at once, with Undo.
- **Withdraw the required consent.** Asked once, because it locks the account: the person is signed out, gets an email confirming the withdrawal, and GenAI Fund's contact is told. Signing in again shows `/consent`, so agreeing again unlocks it. Their data is not deleted; deletion is a separate request (BEY-242).
- **Apply only with the partner purpose.** Submitting an application to a program or a proposal to a use case needs "Share with program partners" on; without it the form says why and offers to turn it on.
- **Stay out of AI.** With "AI suggestions and evaluation" off, the person's talent profile is not indexed for meaning search nor offered by matching, and no AI evaluation is made of their applications. Their profile stays listed and people still review their applications.

## The purposes

| Key        | Box text (GenAI Fund's)                                                                                                          | Required                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `platform` | I have read and agree to BeyondPilot processing my personal data to use the platform and take part in its programs.            | To use the platform          |
| `partners` | I agree to BeyondPilot sharing my information with program partners for matching and evaluation.                                | To submit to a program or use case |
| `ai`       | I agree to BeyondPilot using AI to suggest my profile for relevant opportunities and to help evaluate my applications.         | No                           |
| `updates`  | I agree to receive updates, newsletters and event invitations from BeyondPilot.                                                  | No                           |

The `ai` box is ours, added with GenAI Fund's agreement on 22 October 2026 because Decree 356/2025 art. 10(3) asks for notice of automated processing and a way not to take part. BeyondPilot sends no newsletter today; `updates` is recorded so that one sent later goes only to those who agreed.

## Where it lives

No new module. Consent belongs to the account: it starts at sign-in, the account's status and the gate read it together, and it ends with the account. It lives in `identity` as the feature package `identity.consent`, with its published API in the `identity` root.

The modules that act on a choice (`proposal` for `partners`; `talent`, `search`, `matching` for `ai`) already depend on `identity`, so no dependency edge is added. A separate `consent` module would have needed a new edge from each of them and from `config`, for one table and one rule.

The emails go through an event: `identity` cannot depend on `notification`, which depends on it. `notification` listens to `ConsentWithdrawn`, as it listens to `SignInCodeRequested`. `search` and `matching` listen to `AiConsentChanged` to drop or restore a person's talent profile.

## Decisions

1. **A page, not a dialog, for the required step.** A step nobody may skip has nothing behind it to show, and a page is what the server can redirect every request to. Decidim, a platform run under the GDPR, does the same: a signed-in person who has not accepted the current terms is redirected to them from every page, then sent back where they were going (`.tmp/decidim`, `needs_tos_accepted.rb`). The same frame as the MCP app consent page (`features/identity/app-consent.tsx`). The full text opens in a dialog because it is read, not navigated.
2. **Accept all and Choose one by one, as equal buttons.** Accept all is an active choice of every purpose, as GenAI Fund asked. Choosing one by one is the way to decline the optional ones; it is a full button, not a link, so declining is as visible as agreeing (Decree 356/2025 art. 6(3)). A third button, Required only, was tried on the prototype and dropped as one choice too many.
3. **Nothing is ticked before the person ticks it, and silence is no answer.** The boxes start empty; leaving `/consent` without answering leaves the person at `/consent` (Law 91/2025 art. 9(4)(d)).
4. **Each choice is a new row; rows are never changed or deleted.** The proof the controller must keep (Decree 356/2025 art. 6(2)): the account, the purpose, agreed or declined, the version of the text, when, how (accept all, chosen, settings, undo, the application form) and the request id. A trigger refuses updates and deletes, as on `audit_event`. A person's current choice is the latest row for each purpose. The record is kept for the life of the account; BEY-242 decides what anonymisation keeps.
5. **The text is versioned in the repository and served by the backend.** Each version is an unchanged Markdown file under `backend/src/main/resources/consent/`; a later text is a new file and a new version, never an edit. The backend serves the current one, so what a person agreed to is the file named by the version on their row. Version 1 is GenAI Fund's text of 22 October 2026 with two changes agreed then: the AI purpose, and "pages viewed (with your cookie consent)", since the analytics that see pages viewed run only after the cookie banner is accepted.
6. **A new version asks again only when it must.** Each version names which purposes it asks again. A person whose latest `platform` row is older than the version that last asked it is taken to `/consent`; their other choices carry over unless that version asked them again too. Version 1 asks all four.
7. **No operator screen edits the text.** A new version takes every person back to `/consent`; it is a change to review, not a setting. It happens a few times a year at most.
8. **The server refuses, not only the screen.** A signed-in account without the current `platform` consent gets 403 with the problem code `CONSENT_REQUIRED` on every `/api/**` path except reading who they are (`/api/identity/me`), the consent paths and sign-out. `identity` supplies the check to the filter chain as it supplies `operatorsOnly` (ADR 0004). The MCP server refuses a token whose account lacks it. Public reads stay public.
9. **Withdrawing the required consent locks through the gate, not the account status.** The account stays `active`; without a current `platform` consent the gate refuses it, and agreeing again is the way back. `disabled` stays an operator's decision with its own meaning.
10. **Acknowledged at once, by email.** The person is emailed when they withdraw any purpose, which meets the 2 working days of Decree 356/2025 art. 5(2). GenAI Fund's contact is emailed for a withdrawal of `platform` or `partners`; the address is configuration (`beyondpilot.identity.privacy-contact`), empty in development. Until BEY-243, that email is how GenAI Fund knows to act within 15 days.
11. **What was processed before stays.** Withdrawal does not reach back (Law 91/2025 art. 10(4)). An application already submitted stays with its program and judges when `partners` is turned off; a new submission needs it. AI evaluations already made stay; no new one is made.
12. **AI off means the person's data leaves AI processing, not that they lose AI features.** Their talent profile leaves the meaning search index and matching candidates; their applications get no AI evaluation, shown to operators as "Applicant declined AI". A person with AI off still runs matching on their own use case, which reads organizations and solutions, not their data.
13. **Everyone answers, from their next sign-in.** Existing accounts, operators and judges included, have no consent recorded and meet `/consent` once. Accounts created by the Agentic AI Build Week import meet it at their first sign-in.
14. **Until a person answers, they are treated as not agreeing.** A talent profile whose person has not agreed to `ai` is not offered by matching nor indexed for meaning search. On release, profiles leave AI matching and meaning search until their people sign in and agree; they stay listed and found by their words.
15. **The sign-in line goes.** "By continuing, you accept the Terms of Service and the Privacy Policy" recorded nothing and claimed an acceptance the law does not count. `/consent` replaces it.
16. **The privacy page matches the consent text.** It names GenAI Technology Development Pte. Ltd., drops the promise to delete within 30 days, says requests are acknowledged within 2 working days and lists the purposes as the consent does.
17. **English first.** Version 1 is GenAI Fund's English text. A Vietnamese text, once GenAI Fund provides one, is the same version in a second file; the row records which language was shown.

## HTTP

| Path                              | Use                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| `GET /api/identity/consent`       | The current version, its text in the caller's language, the purposes and the caller's choices |
| `PUT /api/identity/consent`       | Record the caller's choices with how they were made; answers the new state                  |
| `GET /api/identity/me`            | Gains `consentNeeded`                                                                       |

The exact contract is `openapi.yml`.

## Web

| Where                    | What                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `/consent`               | The step: summary, Accept all, Choose one by one (dialog with the full text and boxes), Sign out. `?returnTo=` |
| `/account`               | The section "Privacy and consent" under the contact details                                                  |
| Every signed-in page     | Redirects to `/consent?returnTo=` while `consentNeeded`, except `/consent`, `/privacy` and `/terms`          |
| Application and proposal forms | Without `partners`, say why submitting needs it and offer to turn it on                                |
| `/privacy`, sign-in form | The privacy text updated; the sign-in line removed                                                           |

Composed from `Button` (actions), `Badge`, `Checkbox`, `Field`, `Switch`, `Dialog`, `AlertDialog` and the toast with Undo.

## Data

`V111__identity_consent.sql` creates `identity_consent_record`: `id`, `account_id` (references `identity_account`), `purpose`, `granted`, `version`, `locale`, `source`, `request_id`, `recorded_at`; an index on `(account_id, purpose, recorded_at desc)`; a trigger that refuses update and delete.

## Out of scope

- Anonymising a person's data on request: BEY-242.
- The operators' screen of requests and deadlines, and a person's choices on their account in Admin: BEY-243.
- A newsletter: none exists.
- The processing impact assessment and any cross-border transfer filing: GenAI Fund's, outside the platform.
