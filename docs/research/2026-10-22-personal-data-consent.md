# Personal data consent: what the law asks and what the platform holds

Read on 22 October 2026 for [BEY-240](https://linear.app/beyondpilot/issue/BEY-240/every-user-accepts-the-personal-data-consent-before-using-the-platform), after GenAI Fund asked that every user accept a data-sharing consent before using BeyondPilot. This note records what Vietnam's Personal Data Protection Law and its decree require, what the platform stores today, and where the two meet. It is an engineering reading, not legal advice; GenAI Fund's lawyers confirm the wording.

## Sources

- **Law 91/2025/QH15** on personal data protection, in force from 1 January 2026. Full text read on [LuatVietnam](https://luatvietnam.vn/dan-su/luat-bao-ve-du-lieu-ca-nhan-2025-so-91-2025-qh15-405135-d1.html).
- **Decree 356/2025/ND-CP**, which details the law, with its annex of forms. Consolidated text read on [LuatVietnam](https://luatvietnam.vn/dan-su/nghi-dinh-356-2025-nd-cp-quy-dinh-chi-tiet-luat-bao-ve-du-lieu-ca-nhan-422896-d1.html); Decree 392/2026/ND-CP amends articles 19, 20 and 26, none of which concern consent or data subject rights.
- **Decree 330/2026/ND-CP** on penalties, read only in the [Global Vietnam Lawyers alert](https://gvlawyers.com.vn/wp-content/uploads/2026/08/VN_Legal-alert_-PDP-under-Decree-No.-330.2026-1.pdf) of August 2026.
- Summaries by [PwC](https://www.pwc.com/vn/vn/publications/legal-news-brief/20260128-new-rules-personal-data-protection.html) and [EY](https://www.ey.com/content/dam/ey-unified-site/ey-com/vi-vn/technical/tax/documents/ey-vietnam-legal-alert-march-2026-decree-no356-2025-nd-cp-providing-detailed-guidance-for-implementation-of-personal-data-protection-law-viet.pdf), used to cross-check.
- The repository at `origin/main` on 22 October 2026: Flyway migrations, the backend modules and the web.

## What a valid consent is

| Requirement                                                                                              | Where                       |
| -------------------------------------------------------------------------------------------------------- | --------------------------- |
| Given freely, knowing the kinds of data and the purpose, the controller, and the data subject's rights   | Law art. 9(2)               |
| Expressed clearly and specifically, in a form that can be printed or copied, electronic forms included   | Law art. 9(3)               |
| One consent per purpose; no purpose may be made a condition of another                                    | Law art. 9(4)(a), (b)       |
| Silence or no answer is not consent; no default consent and no wording that blurs agree and disagree     | Law art. 9(4)(d); Decree art. 6(3) |
| Obtained before the data is collected                                                                     | Law art. 11(1)              |
| Verifiable: who consented, when, and to which content; a website or app control counts                   | Decree art. 6(1)            |
| Stored by the controller, who carries the burden of proof in a dispute                                    | Decree art. 6(2)            |
| When the data is sensitive, the person is told that it is                                                 | Decree art. 6(4)            |
| When data is processed automatically, the person is told, the principle of the algorithm and its effect on them are explained, and they are offered a way not to take part | Decree art. 10(3) |

Not every purpose needs consent. Processing to perform an agreement with the data subject is one of the cases the law exempts (Law art. 19(1)(d)), so the data needed to run an account can rest on the terms of use. GenAI Fund nevertheless asked for an explicit consent to use the platform; that is stricter than the law and costs nothing.

The law names no "version", and sets no retention period for consent records. Recording the version of the text a person accepted is how the platform proves "the content consented to" (Decree art. 6(1)); keeping the record for as long as the processing lasts, plus a margin for claims, follows from the burden of proof. No article requires asking again when the text changes; a new purpose needs a new consent because consent is per purpose (Law art. 9(4)(a), 11(1)).

The decree's annex holds no consent template. Form 10, the processing impact assessment, asks the controller to describe its consent process and attach its consent forms.

## Withdrawal and the other rights

The data subject may know about the processing, consent or withdraw, see and correct their data, ask for a copy, deletion or restriction, object, and complain (Law art. 4(1)). Withdrawal is made in writing, electronic or verifiable forms included (Law art. 10(2)), so a recorded action in Settings qualifies. It does not affect processing before it (Law art. 10(4)), and it does not by itself require deletion: deletion is a separate right (Law art. 14).

Every request is acknowledged within 2 working days with the procedure that follows (Decree art. 5). The time to carry it out depends on the request:

| Request                            | Carried out within | With a processor or third party | One extension, with reasons |
| ---------------------------------- | ------------------ | ------------------------------- | --------------------------- |
| Withdraw, restrict, object         | 15 days            | 20 days                         | up to 15 days               |
| See, correct, receive a copy       | 10 days            | 15 days                         | up to 10 days               |
| Delete                             | 20 days            | 30 days                         | up to 20 days               |

GenAI Fund's message gave the 2-day and 15-day figures; they are correct for withdrawal. Deletion has 20 days.

## Sensitive personal data

Decree art. 4(1) lists it: racial or ethnic origin; political or religious views; private life and family secrets; health; biometric and genetic data; sex life and orientation; crime records held by the authorities; location from location services; e-ID credentials and images of an identity card; bank credentials, card data and financial, credit, securities or insurance information held by financial institutions; data that tracks behaviour on telecom, social network, online media and other online services; and other data the law keeps secret.

## What the platform holds

The full inventory, table by table, was read from the migrations. In summary:

- **Account**: email, display name, country, phone, last sign-in, and the Google subject for Google sign-in (`identity_account`, `identity_external_identity`). Sign-in codes are stored hashed.
- **Profiles**: talent name, headline, bio, roles, skills, country, city, languages, photo, website, hourly rate band and projects (`talent_profile`, `talent_project`); organization membership and job title.
- **Applications**: contact details (first and last name, phone, country, LinkedIn), team background, deck, answers, and a snapshot at each submission (`proposal`, `proposal_version`); judges' scores and private notes about each application.
- **Messages**: conversation bodies and who read them.
- **Email log**: each sent email's recipient and rendered body (`email_message`); a suppression list of addresses.
- **Audit log**: the actor's id, name and email for every recorded action; append-only by a trigger.
- **AI**: talent profiles are indexed for search and sent to the embedding provider; matching ranks solutions and talent for a use case; the evaluation board gives each applicant an AI-suggested tier with quotes from their material (`evaluation_assessment`).
- **From third parties**: Google sign-in (subject, email, name). The Agentic AI Build Week import created accounts and hidden draft talent profiles for registrants who never signed up; the v1 import created organization invitations by email for v1 people.

Against the sensitive list: the platform asks for no identity card, health or biometric data, and its country and city fields are typed by the person, not read from location services. The hourly rate band is financial but not held by a financial institution. The cookie banner already keeps analytics off until the visitor accepts it (`web/src/lib/analytics-consent.ts`), which matters because behaviour tracking is on the sensitive list. On this reading the platform processes no sensitive data; GenAI Fund's lawyers confirm it.

## What exists today and where it falls short

- **No consent is recorded.** The sign-in form says "By continuing, you accept the Terms of Service and the Privacy Policy" and records nothing (`web/src/features/identity/sign-in-form.tsx`). That is the passive acceptance the law rules out.
- **No step stops a signed-in user.** Pages only send signed-out visitors to sign-in (`web/src/lib/auth/session.ts`); the middleware has no account check.
- **Account status already refuses work.** A disabled account cannot sign in, and every service checks `IdentityService.requireActive` on each call. A withdrawal of the required consent can reuse it.
- **Nothing deletes an account.** Only a talent profile can be deleted by its owner; most tables reference `identity_account` without cascade, and the audit log cannot be changed. Deleting a person's data within 20 days needs new work.
- **The privacy page promises more than the code does.** It says accounts are deleted or anonymised within 30 days on request to team@beyondpilot.ai (`web/messages/en.json`, `Legal.privacy`). The law allows 20 days for deletion, and nothing implements it.
- **AI processing is not explained.** Matching and the evaluation board process people's profiles and applications automatically. Decree art. 10(3) asks for a notice, an explanation and a way to opt out.
- **Settings has one section.** `/account` holds the contact form; connected MCP apps sit at `/account/mcp`.
- **Email is ready.** The `notification` module sends a kind of email from a Markdown template, so the withdrawal acknowledgement is a new kind and template.

## The processing impact assessment

The controller files a processing impact assessment (form 10, with notice form 02a or 02b) with the Ministry of Public Security within 60 days of first processing, and updates it every 6 months when a purpose or party is added (Law art. 21; Decree art. 19, 20). Small enterprises and startups may skip it, and the data protection officer, for 5 years from 1 January 2026, unless they process sensitive data directly or reach 100,000 data subjects (Law art. 38; Decree art. 41). This is GenAI Fund's filing, not a change to the platform.

## Penalties

The law caps fines for most violations at 3 billion VND for an organisation (Law art. 8). Decree 330/2026, as summarised by Global Vietnam Lawyers, sets for example up to 70 million VND for treating silence as consent, 10 to 20 million VND for having no procedure for data subject requests, and 50 to 70 million VND for failing to notify or explain AI processing.

## Libraries and generators considered

- [nisrulz/app-privacy-policy-generator](https://github.com/nisrulz/app-privacy-policy-generator) generates privacy policy text from a form, with a GDPR template, under AGPL-3.0. It captures no consent, keeps no record and offers no withdrawal; useful only as a checklist of policy sections.
- [c15t](https://github.com/c15t/c15t) and the [CookieYes SDK](https://www.cookieyes.com/blog/react-cookie-consent-sdk/) are cookie banners for React, not consent bound to an account.
- No Spring library records account-bound, versioned consent. [Convex Consent Ledger](https://www.convex.dev/components/vllnt/convex-consent) and [laravel-gdpr-consent-database](https://root.packagist.org/packages/selli/laravel-gdpr-consent-database) show the shape: an append-only record of each grant and withdrawal, bound to the version of the text, with a new version making earlier grants stale.
