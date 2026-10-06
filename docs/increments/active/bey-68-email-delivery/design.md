# BEY-68 — Email delivery that operators run

Status: in design, 6 October 2026 ([plan](plan.md)). The screens were approved in Figma the same day (section `Admin — Email (draft for review, BEY-68)`). What was studied before this design is on the Linear issue BEY-68: Jmix, ThingsBoard, Keycloak, Apache Syncope, Liferay, Discourse, listmonk and Novu in code or documentation; Supabase, Shopify, Homerun, AutoSend, Resend, Linear, n8n and Klaviyo on Mobbin; and the template engines, Spring Modulith 2.1.1 and the provider SDKs.

## Why

`notification.EmailService` sends seventeen kinds of email over SMTP, in the caller's thread:

- A failed send fails the business operation that triggered it, or is lost when the caller swallows it (`SubmissionMail`, `ReviewMail`). Nothing retries.
- Nothing records what was sent, to whom, or whether it arrived. An operator cannot answer "why did I not get my code?".
- Bounces and complaints are never seen. Sending again and again to a dead address damages the domain's reputation with mailbox providers, and Amazon SES reviews an account that bounces more than 5% or draws complaints from more than 0.1%.
- The wording is Java code; changing a sentence needs a release.
- Production has no provider. Local runs and staging deliver to Mailpit.

## Outcome

Operators get **Admin › Email** with four tabs:

- **Templates.** Each kind of email, by group, with its English and Vietnamese text. An operator edits the subject and the body in Markdown with the kind's variables, sees a preview with sample data, sends a test to themselves, and resets to the default. The appearance (logo, accent colour, footer) is shared by every kind.
- **Activity.** Every email sent: when, to whom, which kind, its status. Counts for the period, with the bounce and complaint rates against the limits above. One email opens with its events and the content as it was sent; it can be sent again unless its address is suppressed.
- **Suppressions.** The addresses BeyondPilot no longer sends to, with the reason and the email that caused it. An operator removes one after a warning, or adds one.
- **Settings.** The setup checklist (provider connected, domain verified, production access, delivery events), the provider (Amazon SES, Resend or SMTP) with its credentials, a connection test that sends to the operator's own address, the sender, the domain's DNS records, and the address that receives delivery events.

Mailpit is removed from every composition. Staging sends through Resend once an operator has configured it there.

## Domain story

1. A module asks for an email: a sign-in code, an invitation, a decision. Notification renders it from the kind's template and the values it was given, and records it as **queued** in the caller's transaction. If that transaction rolls back, nothing is sent.
2. After commit, the email is handed to the configured provider. It becomes **sent** with the provider's message identifier, or stays queued with a later attempt time when the provider fails for a while, or becomes **failed** when the provider refuses it for good or the attempts run out.
3. A sign-in code is sent at once instead, because a person is waiting on the screen; a failure tells them to try again in a moment, as today.
4. The provider later reports the email **delivered**, **bounced** or **complained**. A permanent bounce or a complaint suppresses the address: later emails to it are recorded as **skipped** and never handed over.
5. An operator configures the provider, edits a template or removes a suppression. Each change is recorded in the audit log.

_Failures:_ no provider configured (emails wait as queued, sign-in by code answers "try again", every Email tab shows the setup banner); the provider is down (attempts back off; after 24 hours the email fails); credentials are wrong (the connection test says so; sending fails and is retried); the encryption key is missing (credentials cannot be saved or read, and the Settings tab says so); a template that does not compile (refused on save, so the stored template always renders).

## Glossary

| Term               | Meaning                                                                                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Email kind**     | What an email is for, from a closed catalog: `sign_in_code`, `organization_invitation`, … Each kind declares its variables, which of them are required, and its default English and Vietnamese text |
| **Template**       | The subject and the Markdown body of one kind in one language. The default lives in code; an operator's edit is stored as an **override**, and resetting deletes the override (Discourse)           |
| **Appearance**     | The logo, accent colour and footer of the fixed HTML layout every email is wrapped in                                                                                                               |
| **Email message**  | One email to one recipient, as rendered when it was queued, with its status and events                                                                                                              |
| **Status**         | `queued`, `sent`, `delivered`, `bounced`, `complained`, `failed`, `skipped`                                                                                                                         |
| **Suppression**    | An address BeyondPilot does not send to, with its reason: `bounce`, `complaint` or `manual`                                                                                                         |
| **Provider**       | Who delivers: `ses`, `resend` or `smtp`                                                                                                                                                             |
| **Delivery event** | A provider's report about one message: delivered, bounced, complained                                                                                                                               |

Notification is the owner of all of it.

## Module position

`notification` today depends on nothing and `identity` depends on it to send the sign-in code. The operator screens need the caller (`Actor`), the operator check and the operator's name and address (for the audit log, "Edited by" and "send a test to me"), all of which are `identity`'s, and a logo stored in `storage`.

**Proposed: invert the edge.** `notification` depends on `identity`, `audit` and `storage`; `identity` no longer depends on `notification`.

- `identity` publishes `SignInCodeRequested(email, code, validFor, locale)` in its root package. `notification` handles it in a synchronous `@EventListener`, which sends the code before the request is answered. A failure surfaces as a `BusinessException` of category `SERVICE_UNAVAILABLE`, which `SignInCodeSender` turns into `503` with `Retry-After`, as today, without naming a notification type.
- This event departs from [events between modules](../../../conventions.md#events-between-modules) in two ways, both on purpose. It carries the code, because the code exists in clear only at that moment (identity stores a hash). It is handled synchronously and not by `@ApplicationModuleListener`, so it is never written to the event publication registry: the code never reaches a table, and the person on the screen learns at once whether it was sent.
- Every other caller keeps calling `EmailService` as it does now; their modules already depend on `identity` and `notification`.

Alternatives:

- **Keep the edge and authorize like the audit log** ([ADR 0004](../../../decisions/0004-the-filter-chain-keeps-the-audit-log-for-operators.md)): the filter chain checks the role. It covers the role, not the operator's name and address, which the audit record, "Edited by" and the test send need; those would need a second by-name bean contract between `identity` and `notification`.
- **A second module for the email administration**, depending on `identity` and `notification`. Two modules would share one language, one owner of the tables and one lifecycle, which [boundary discovery](../../../conventions.md#boundary-discovery) keeps together.
- **An interface in `identity` that `notification` implements** to send the code. One implementation by nature, which the [change design rules](../../../conventions.md#change-design) refuse.

The edge change is recorded as an ADR once accepted.

## Configuration lives in the database

Operators choose and change the provider without a release (decided by Đạt, 6 October 2026). This departs from "configuration comes from environment variables" for this one subject, as Keycloak, ThingsBoard, Immich and WP Mail SMTP do.

- **One row, `email_settings`**: provider, sender name and address, reply-to, the provider's connection fields, the appearance, and a version. Saving bumps the version and rebuilds the provider's client on the next send.
- **Secrets are encrypted field by field** (Novu): an SMTP password, an AWS secret key, a Resend API key, a webhook signing secret. AES-256-GCM through Spring Security Crypto's `AesBytesEncryptor` with a random IV per value. The key is `BEYONDPILOT_NOTIFICATION_ENCRYPTION_KEY`, 32 bytes in Base64, a secret file on a deployed host. Without it nothing secret is saved or read (fail closed); the rest of the application runs.
- **A secret is never read back.** The API returns whether each secret is set, never its value. A save that leaves a secret empty keeps the stored one (listmonk, ThingsBoard).
- **The connection test reuses a stored secret only when the host, port, user, region or key identifier it belongs to is unchanged** (Keycloak's `reuseConfiguredAuthenticationForSmtp`). Otherwise an operator could point the test at their own server and receive the stored password.
- **The test goes only to the signed-in operator's own address.**
- Nothing is configured from the environment, so a fresh database sends nothing until an operator sets it up. Operators can always sign in with Google, and with a code once the provider works.

## Providers

The [Strategy-behind-a-registry pattern](../../../conventions.md#interchangeable-implementations-strategy-behind-a-registry), closed family:

- `EmailProvider` (`SES`, `RESEND`, `SMTP`), persisted.
- `EmailAdapter` with `provider()`, `capabilities()` and `send(EmailRequest, EmailConnection) → EmailResult`. `EmailConnection` is a sealed interface with one record per provider (`SesConnection`, `ResendConnection`, `SmtpConnection`), so a connection cannot hold another provider's fields.
- `SesEmailAdapter` uses the AWS SDK v2 `sesv2` client (`SendEmail` with a configuration set and tags), on the same SDK BOM and HTTP client as storage. Not Spring Cloud AWS: its starter is on the SES v1 API and pins an older SDK.
- `ResendEmailAdapter` uses `com.resend:resend-java`, with the message identifier as idempotency key, and its `Webhooks.verify` for delivery events.
- `SmtpEmailAdapter` builds a `JavaMailSenderImpl` from the connection. Spring Boot no longer configures a mail sender (`spring.mail.*` is removed).
- `EmailAdapterRegistry` fails startup when a provider has no adapter or two.
- Clients are cached by settings version and closed when replaced.

## Templates

- **Engine: JMustache**, managed by Spring Boot. Logic-less: no method call, no `new`, no import, so a template can reach only the values it is given. FreeMarker (ThingsBoard CVE-2023-45303, OpenMetadata), Thymeleaf (three sandbox escapes in 2026) and Pebble (a blocklist that was bypassed) were ruled out for templates that operators edit.
- **Validated on save** by visiting the compiled template: only the kind's variables, no dotted names, sections, partials or triple braces, and every required variable present. A sign-in code without `{{code}}` cannot be saved.
- **Markdown first, then values.** The body is converted from Markdown to HTML with commonmark-java (raw HTML escaped, URLs sanitized), and only then are the values filled in, HTML-escaped and with line breaks kept. A value written by a visitor, such as the message of an enquiry, therefore cannot turn into a link or markup. The plain-text part fills the values into the Markdown source.
- **The layout is fixed**: table-based HTML with inline styles, written once from MJML and committed as a resource. Only the appearance's values go into it.
- **Language.** A kind is written in English and Vietnamese. When the recipient's language is known (the sign-in code), the email is in that language; otherwise the email carries both, English first, as today.
- **The defaults** are today's wording, moved from Java into the catalog. The admin list shows "Edited" with who and when for an override.

The catalog is the seventeen kinds `EmailService` sends today:

| Group         | Kinds                                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| Sign-in       | sign-in code                                                                                                         |
| Organizations | invitation, decision                                                                                                 |
| Applications  | application submitted, judge invitation, application outcome                                                         |
| Introductions | introduction request, introduction made, introduction declined                                                       |
| Talent        | decision on a profile, message through a profile, reminder to answer, introduction, message declined, message closed |

`application_outcome` carries a subject and a message an operator wrote for that release; its template frames them.

## Sending

**Spring Modulith's event publication registry triggers delivery; `email_message` is the queue and the log.** The registry alone cannot be the queue (Spring Modulith 2.1.1, read in `.tmp/spring-modulith`): it has no retry, backoff or attempt limit (`staleness` only marks a publication failed), no rate limit, and holds neither recipient nor kind, so it cannot back the Activity tab, a resend or a bounce. Jmix (`SendingMessage`) and Syncope (`NotificationTask`) keep such a table for the same reasons.

1. `EmailService.send…` renders the email and inserts an `email_message` row (`queued`) in the caller's transaction, and publishes `EmailQueued(id)`. An address that is suppressed is inserted as `skipped` instead and nothing is published.
2. A package-private `@ApplicationModuleListener` handles `EmailQueued` after commit: it claims the row (`queued` and due), sends it, and stores `sent` with the provider's message identifier. A temporary failure stores the attempt count and the next attempt time (1, 5, 15, 30, 60 minutes, then hourly) and returns normally, so the publication completes and the table owns the retry. A permanent refusal stores `failed`.
3. A scheduled sweep every minute sends queued rows that are due, claimed with `FOR UPDATE SKIP LOCKED`, at most 10 per second and 100 per sweep. A row queued more than 24 hours ago becomes `failed`.
4. **The sign-in code** is inserted and sent in the same thread.
5. **What is stored is what was sent**, rendered at queue time (Syncope), so a later template edit does not rewrite history. The sign-in code is stored with the code masked.
6. **Retention.** A nightly job deletes messages older than 90 days with their events. The content holds names and addresses; 90 days covers every question an operator asks about delivery.

`SubmissionMail` and `ReviewMail` keep calling after commit; their catch blocks remain for a failure to queue.

## Delivery events and suppression

- **Resend** posts signed webhooks; `POST /api/notification/events/resend` verifies the Svix signature with the signing secret from Settings before reading anything.
- **Amazon SES** publishes the configuration set's events to an SNS topic subscribed over HTTPS to `POST /api/notification/events/ses`. The endpoint confirms the subscription, verifies every message's SNS signature and checks the topic against Settings.
- **SMTP** reports nothing; its emails stay `sent`.
- An event is matched by provider message identifier, stored as an `email_event`, and moves the message's status forward only.
- A permanent bounce or a complaint adds a suppression (listmonk's rules: one hard bounce, one complaint). A soft bounce is recorded and suppresses nothing.
- Both endpoints are open to the provider without a session or CSRF header, and refuse anything that does not verify.

## API

All under `/api/notification`, operators only, checked in the application service with the caller's `Actor`. Every change records an audit event.

| Operation                               | Address                                                |
| --------------------------------------- | ------------------------------------------------------ |
| Settings, setup state, DNS records      | `GET /settings`                                        |
| Save settings                           | `PUT /settings`                                        |
| Test the connection (send to me)        | `POST /settings/test`                                  |
| Upload a logo                           | through storage, then `PUT /settings` with its file    |
| Templates by group, with override state | `GET /templates`                                       |
| One template, both languages            | `GET /templates/{kind}`                                |
| Save an override                        | `PUT /templates/{kind}/{locale}`                       |
| Reset to default                        | `DELETE /templates/{kind}/{locale}`                    |
| Preview with sample data                | `POST /templates/{kind}/{locale}/preview`              |
| Send a test of a template to me         | `POST /templates/{kind}/{locale}/test`                 |
| Activity, with counts                   | `GET /messages?from=&kind=&status=&q=&before=&after=`  |
| One message, its events and content     | `GET /messages/{id}`                                   |
| Send again                              | `POST /messages/{id}/resend`                           |
| Suppressions                            | `GET /suppressions?reason=&q=&page=`                   |
| Add, remove                             | `POST /suppressions`, `DELETE /suppressions/{address}` |
| Delivery events                         | `POST /events/resend`, `POST /events/ses` (no session) |

Activity is paged by cursor like the audit log (it only grows and is read from the newest end). Suppressions are a small set an operator searches, paged by number like Accounts.

New audit actions: `email.settings_update`, `email.template_update`, `email.template_reset`, `email.suppression_add`, `email.suppression_remove`, `email.resend`.

## Persistence

`V<n>__notification_create_email.sql`:

- `email_settings` (one row, `id = 1`), with `version`, the encrypted secrets as `bytea`, and the appearance's logo as a storage file identifier.
- `email_template` (`kind`, `locale`, `subject`, `body`, `updated_by`, `updated_by_label`, `updated_at`), primary key `(kind, locale)`.
- `email_message` (`id`, `kind`, `locale`, `recipient`, `subject`, `html`, `text`, `status`, `attempts`, `next_attempt_at`, `provider`, `provider_message_id` unique, `last_error_code`, `created_at`, `sent_at`), indexed `(created_at desc, id desc)` and `(status, next_attempt_at)`.
- `email_event` (`message_id`, `type`, `occurred_at`, `detail`).
- `email_suppression` (`address` primary key, lowercased; `reason`, `message_id`, `created_by`, `created_at`).

Entities and Spring Data repositories for settings, templates and suppressions; `JdbcClient` repositories for the queue claim and the Activity read.

## Web

- `src/app/[locale]/admin/email/{templates,activity,suppressions,settings}` and the detail pages, each `requireRole("operator")`. The sidebar gains Email.
- `src/features/email/`, following `features/audit` and `features/organization`: lists read on the server from the address, writes from the browser ending in a refresh.
- Accounts' row menu gains "Emails sent to this person", a link to Activity filtered by that address.
- Both catalogs under `Admin.email`; the template text itself is the backend's and is shown as stored.

## Infrastructure

- Mailpit leaves `backend/compose.yaml` and the three compositions; `BEYONDPILOT_MAIL_*` and `spring.mail.*` go.
- Staging gains the secret file for `BEYONDPILOT_NOTIFICATION_ENCRYPTION_KEY`; the runbook says how to make it, never its value.

## Not in this increment

Marketing or bulk email with unsubscribe, open and click tracking, inbound email, per-person notification preferences, attachments, a drag-and-drop template editor, and more than one provider at once. Each waits until something asks for it.
