# Personal data consent

Every signed-in person agrees to how BeyondPilot uses their personal data before they use the platform, one purpose at a time, and can change each choice later in Settings. Tracked in Linear as BEY-240. GenAI Fund asked for it on 22 October 2026 to comply with Vietnam's Personal Data Protection Law (Law 91/2025/QH15) and Decree 356/2025/ND-CP; what the law asks and what the platform holds are in the [research note](../../../research/2026-10-22-personal-data-consent.md). GenAI Fund wrote the consent text the same day. The screens were decided on a clickable HTML prototype, built from the application's tokens and primitives, with the member who directs BEY-240.

Two parts are separate issues: anonymising a person's data when they ask for deletion (BEY-242), and the operators' screen of privacy requests with their deadlines (BEY-243).

## What a person can do

- **Agree after signing in.** A signed-in person who has not agreed to the current version of the required purpose is taken to `/consent` from any page. It says in one paragraph what they agree to and lists the four purposes with what each is (required, needed to apply, optional). **Accept all** turns on all four; **Choose one by one** opens the full text with one unticked box for each purpose. Agreeing returns them to the page they were going to. **Sign out** is the way out for someone who does not agree.
- **Read the full text.** The text GenAI Fund wrote, in a dialog: who we are, what data, why, who it is shared with, how long, the person's rights, and the four boxes.
- **Change a choice.** Settings (`/account`) gains a card "Privacy and data", laid out as products such as Mixpanel, Pinterest and Sora lay out their data controls: a lead with the way to read the text again, a switch for each purpose but the platform, a row with the address for other requests about one's data, and a row to withdraw the consent to use the platform. Turning a purpose off or on takes effect at once, with Undo. Using the platform is no switch beside the others, so it is not turned off by a slip; decided on 23 October 2026 by the member who directs BEY-240, on a clickable prototype.
- **Withdraw the required consent.** Asked once, because afterwards the person cannot use BeyondPilot: every page leads back to `/consent`, and every tool of their AI apps answers with where to agree. The person gets an email confirming the withdrawal, which is their record of it now that Settings is out of reach. Agreeing again is the way back. Their data is not deleted; deletion is a separate request (BEY-242).
- **Apply only with the partner purpose.** Submitting an application to a program or sending a proposal to a use case needs "Share with program partners" on; without it the form shows why, by its failure code, and says to turn it on in Settings.
- **Stay out of AI.** With "AI suggestions and evaluation" declined, the person's talent profile is not sent to the embedding provider for meaning search, and no AI evaluation is made of the applications and proposals they submitted. Their profile stays listed and found by its words, and people still review their applications.

## The purposes

| Key        | Box text (GenAI Fund's)                                                                                                | Required                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `platform` | I have read and agree to BeyondPilot processing my personal data to use the platform and take part in its programs.    | To use the platform                |
| `partners` | I agree to BeyondPilot sharing my information with program partners for matching and evaluation.                       | To submit to a program or use case |
| `ai`       | I agree to BeyondPilot using AI to suggest my profile for relevant opportunities and to help evaluate my applications. | No                                 |
| `updates`  | I agree to receive updates, newsletters and event invitations from BeyondPilot.                                        | No                                 |

The `ai` box is ours, added with GenAI Fund's agreement on 22 October 2026 because Decree 356/2025 art. 10(3) asks for notice of automated processing and a way not to take part. BeyondPilot sends no newsletter today; `updates` is recorded so that one sent later goes only to those who agreed.

## Where it lives

No new module. Consent belongs to the account: it starts at sign-in, the account's status and the gate read it together, and it ends with the account. It lives in `identity`: `Consents` and `ConsentPurpose` in its root as the published API, the record in its `persistence` package.

The modules that act on a choice (`proposal` for `partners`; `talent`, `search` and `matching` for `ai`) already depend on `identity`, so no dependency edge is added. A separate `consent` module would have needed a new edge from each of them, for one table and one rule.

`Consents` publishes `ConsentChanged` for every choice it records. `notification` handles it after the choice commits, so that a failure to send never undoes a withdrawal (`identity` cannot depend on `notification`); `talent` listens to it to have its profile indexed again.

## Decisions

1. **A page, not a dialog, for the required step.** A step nobody may skip has nothing behind it to show, and a page is what the server can redirect every request to. Decidim, a platform run under the GDPR, does the same: a signed-in person who has not accepted the current terms is redirected to them from every page, then sent back where they were going (`.tmp/decidim`, `needs_tos_accepted.rb`). The same frame as the MCP app consent page (`features/identity/app-consent.tsx`). The full text opens in a dialog because it is read, not navigated.
2. **Accept all and Choose one by one, as equal buttons.** Accept all is an active choice of every purpose, as GenAI Fund asked. Choosing one by one is the way to decline the optional ones; it is a full button, not a link, so declining is as visible as agreeing (Decree 356/2025 art. 6(3)). A third button, Required only, was tried on the prototype and dropped as one choice too many.
3. **Nothing is ticked before the person ticks it, and silence is no answer.** The boxes start empty; leaving `/consent` without answering leaves the person at `/consent` (Law 91/2025 art. 9(4)(d)).
4. **Each choice is a new row; rows are never changed or deleted.** The proof the controller must keep (Decree 356/2025 art. 6(2)): the account, the purpose, agreed or declined, the version of the text, when, how (accept all, chosen, settings, undo, the application form) and the request id. A trigger refuses updates and deletes, as on `audit_event`. A person's current choice is the latest row for each purpose. The record is kept for the life of the account; BEY-242 decides what anonymisation keeps.
5. **The text is versioned in the repository and served by the backend.** Each version is an unchanged Markdown file under `backend/src/main/resources/consent/`; a later text is a new file and a new version, never an edit. The backend serves the current one, so what a person agreed to is the file named by the version on their row. Version 1 is GenAI Fund's text of 22 October 2026 with two changes agreed then: the AI purpose, and "pages viewed (with your cookie consent)", since the analytics that see pages viewed run only after the cookie banner is accepted.
6. **A new version asks again only when it must.** Each version names which purposes it asks again. A person whose latest `platform` row is older than the version that last asked it is taken to `/consent`; their other choices carry over unless that version asked them again too. Version 1 asks all four.
7. **No operator screen edits the text.** A new version takes every person back to `/consent`; it is a change to review, not a setting. It happens a few times a year at most.
8. **Pages ask; the MCP servers refuse.** Every signed-in page sends a person without the current `platform` consent to `/consent`, as Decidim sends a person to its terms from every page and lets other requests through (`needs_tos_accepted.rb`: `return true unless request.format.html?`). The API does not refuse them: the only one who could reach it around the page is the person themselves, reading their own data, and a refusal on every path would cost a check on every request. The MCP servers do refuse, since a person who connected an AI app could use BeyondPilot through it without ever opening a page; decision 18 sets how. The two choices that change what happens to a person's data are checked by the server where they act: submitting needs `partners`, and AI skips a person who declined `ai`. Decided on 22 October 2026 by the member who directs BEY-240, after an earlier draft refused every API path.
9. **Withdrawing the required consent stops the person through the page, not the account status.** The account stays `active`; without a current `platform` consent every page leads to `/consent` and the MCP tools refuse it, and agreeing again is the way back. The screens and the email say "you cannot use BeyondPilot until you agree again", never that the account is locked, since nothing needs an operator to undo. `disabled` stays an operator's decision with its own meaning.
10. **A choice takes effect at once; only a withdrawal of the platform purpose is emailed.** Turning a purpose off in Settings acts immediately, and the screen says so: that is the answer Decree 356/2025 art. 5(2) asks for within 2 working days, and the record proves it. Withdrawing `platform` stops the person using BeyondPilot, so they get an email confirming it. Nobody at GenAI Fund is emailed: a withdrawal needs no one to act, as in a consent platform such as OneTrust, where a preference centre records a withdrawal and applies it; a request to delete data does, and that is BEY-242 and BEY-243. Decided on 22 October 2026 by the member who directs BEY-240, replacing an email to a GenAI Fund contact.
11. **What was processed before stays.** Withdrawal does not reach back (Law 91/2025 art. 10(4)). An application already submitted stays with its program and judges when `partners` is turned off; a new submission needs it. AI evaluations already made stay; no new one is made.
12. **AI declined means the person's data leaves AI processing, not that they lose AI features.** Their talent profile keeps its place in the search index but gets no embedding, so meaning search does not find it and its text is not sent to the embedding provider; keyword search and the directory still do. Their applications and proposals are left out of what matching reads (`ReviewService.submissionsTo`, `UseCaseProposals.sentTo`), so neither a program's evaluation board nor a use case's proposal evaluation assesses them; people review them in the review screens as before. An assessment made before the person declined stays, since a withdrawal does not reach back. Matching reads organizations, solutions and use cases, not people, so it is unchanged. A person who declined AI still runs every AI feature on their own records, such as matching on their own use case.
13. **Everyone answers, from their next sign-in.** Existing accounts, operators and judges included, have no consent recorded and meet `/consent` once. Accounts created by the Agentic AI Build Week import meet it at their first sign-in.
14. **AI stops only for a person who declined it.** A person's data leaves AI processing when their latest `ai` choice is a decline. An existing account that has not answered yet keeps today's processing until it answers at its next sign-in; a new account answers before it holds any data. Decided on 22 October 2026 by the member who directs BEY-240, accepting that silence is not consent for the short time before an existing account signs in again.
15. **The sign-in line goes.** "By continuing, you accept the Terms of Service and the Privacy Policy" recorded nothing and claimed an acceptance the law does not count. `/consent` replaces it.
16. **The privacy page matches the consent text.** It names GenAI Technology Development Pte. Ltd., drops the promise to delete within 30 days, says requests are acknowledged within 2 working days and lists the purposes as the consent does.
17. **English first.** Version 1 is GenAI Fund's English text. A Vietnamese text, once GenAI Fund provides one, is the same version in a second file; the row records which language was shown.
18. **The MCP servers refuse at the tool, not the token.** A caller without the current `platform` consent keeps a working token: the app connects and lists the tools, and every tool call answers an error result that says to agree at `/consent`, recorded as `refused` in the call log. Version 1 refused the token itself with `invalid_token`; on 23 October 2026, the morning after the production release, GenAI Fund's lead's app was refused 532 times in under two hours and reported an access token problem, because an app reads `invalid_token` as a broken token, fetches a new one and tries again, and never shows the reason. A `403` would fare no better: with `insufficient_scope` the MCP specification has the app ask for authorization again, and without it the person sees only "Forbidden". An app passes a tool's answer on to its person. Initializing and listing the tools hold no personal data. Decided on 23 October 2026 by the member who directs BEY-240.

## HTTP

| Path                        | Use                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| `GET /api/identity/consent` | The current version, its text in the caller's language, the purposes and the caller's choices |
| `PUT /api/identity/consent` | Record the caller's choices with how they were made; answers the new state                    |
| `GET /api/identity/me`      | Gains `consentNeeded`                                                                         |

The exact contract is `openapi.yml`.

## Web

| Where                          | What                                                                                                                                                                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/consent`                     | The step: summary, Accept all, Choose one by one (dialog with the full text and boxes), Sign out. `?returnTo=`                                                                                                                           |
| `/account`                     | The card "Privacy and data" under the contact details                                                                                                                                                                                    |
| Every signed-in page           | Redirects to `/consent?returnTo=` while `consentNeeded`, except `/consent`, `/privacy` and `/terms`: on the server for a page that needs an account (`requireAccount`), and from the site header on every other page (`ConsentRedirect`) |
| Application and proposal forms | Without `partners`, the refusal `IDENTITY_PARTNERS_CONSENT_REQUIRED` says to turn it on in Settings                                                                                                                                      |
| `/privacy`, sign-in form       | The privacy text updated; the sign-in line removed                                                                                                                                                                                       |

Composed from `Button` and `TextButton` (actions), `Badge`, `Checkbox`, `Field`, `Switch`, `Dialog`, `ConfirmDialog` and the toast with Undo. The dialog renders the served Markdown with `react-markdown` and takes each box's words from the text's own list of boxes, so a person ticks the words of the version recorded with their choice.

## Data

`V112__identity_create_consent_records.sql` creates `identity_consent_record`: `id`, `account_id` (references `identity_account`), `purpose`, `granted`, `version`, `locale`, `source`, `request_id`, `recorded_at`; an index on `(account_id, purpose, recorded_at desc)`; a trigger that refuses update and delete.

## Out of scope

- Anonymising a person's data on request: BEY-242.
- The operators' screen of requests and deadlines, and a person's choices on their account in Admin: BEY-243.
- A newsletter: none exists.
- The processing impact assessment and any cross-border transfer filing: GenAI Fund's, outside the platform.
