# Email

BeyondPilot's email: what it sends, in which words, through which provider, and what became of each message. Operators
run it from Admin › Email. It is decided in [ADR 0005](../decisions/0005-operators-run-email-delivery.md) and
delivered by [BEY-68](../increments/completed/bey-68-email-delivery/design.md). The code is the `notification`
application module, `backend/src/main/java/ai/genaifund/beyondpilot/notification`. Its checks are in the
[test matrix](../tests/notification.md).

## Module

- **Published API.** The package root: `EmailService` (with `TalentDecision` and `SolutionDecision`),
  `EmailSettingsAdministration`, `EmailTemplateAdministration`, `EmailActivity`, `EmailSuppressions`,
  `EmailEventIntake`, `NotificationErrorCode`, `NotificationException` and `NotificationProperties`.
- **Internal packages.**
  - `template`: kinds, defaults, rendering.
  - `delivery`: the queue worker and delivery reports.
  - `settings`: `DeliverySettings` and `SecretBox`.
  - `adapter`: the providers.
  - `persistence`: SQL and the two JPA entities.
  - `web` and `dto`: the HTTP contract.
- **Persistence.** One migration, `V41__notification_create_email.sql`, creates every table:
  - `email_settings`: one row, `id = 1`.
  - `email_template`: an operator's wording of a kind.
  - `email_message`: the queue and the log.
  - `email_event`: provider reports.
  - `email_suppression`: addresses never sent to.
- **Dependencies.** `@ApplicationModule(type = CLOSED, allowedDependencies = { "audit", "identity" })`.
  - **`identity` does not depend on this module.** It publishes `SignInCodeRequested`, and `SignInCodeMail` sends it.
  - **Modules that call `EmailService`:** `organization`, `introduction`, `proposal`, `solution`, `talent` and
    `usecase`.

## Kinds of email

`EmailKind` is the catalog. Its value is stored with every message and every operator's wording, so a value keeps its
meaning.

- **Variables.** Each kind declares the variables it offers. Each variable is one of:
  - required: every template of the kind must use it;
  - optional;
  - a quote: the layout shows it after the text, as written, and templates do not use it.
- **Groups.** Each kind belongs to an `EmailGroup`, which is where the screen lists it.

| Group           | Kinds                                                                                                                                                                                                                      | Sent through `EmailService`                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sign_in`       | `sign_in_code`                                                                                                                                                                                                             | `sendSignInCode`, package-private, called by `SignInCodeMail`                                                                                            |
| `organizations` | `organization_invitation`, `organization_approved`, `organization_refused`, `organization_sent_back`, `organization_request_approved`, `organization_request_declined`, `organization_taken_down`, `organization_restored`, `organization_merged` | `sendOrganizationInvitation`, `sendOrganizationDecision`, `sendOrganizationSentBack`, `sendOrganizationRequestDecision`, `sendOrganizationSuspension`, `sendOrganizationMerged`    |
| `applications`  | `application_received`, `reviewer_invitation`, `application_outcome`                                                                                                                                                       | `sendApplicationReceived`, `sendReviewerInvitation`, `sendApplicationOutcome`                                                                            |
| `introductions` | `introduction_request`, `introduction_made`, `introduction_declined`                                                                                                                                                       | `sendIntroductionRequest`, `sendIntroduction`, `sendIntroductionDeclined`                                                                                |
| `solutions`     | `solution_approved`, `solution_sent_back`, `solution_rejected`, `solution_taken_down`, `solution_restored`                                                                                                                 | `sendSolutionDecision`                                                                                                                                   |
| `use_cases`     | `use_case_approved`, `use_case_sent_back`                                                                                                                                                                                  | `sendUseCaseDecision`                                                                                                                                    |
| `talent`        | `talent_approved`, `talent_changes_requested`, `talent_removed`, `talent_restored`, `talent_enquiry`, `talent_enquiry_reminder`, `talent_introduction`, `talent_enquiry_declined`, `talent_enquiry_closed`                 | `sendTalentDecision`, `sendTalentEnquiry`, `sendTalentEnquiryReminder`, `sendTalentIntroduction`, `sendTalentEnquiryDeclined`, `sendTalentEnquiryClosed` |

**`application_outcome` cannot be edited.** An operator writes its subject and message for each release of outcomes.
The message is plain text, and its line breaks are kept.

**Contents of the emails:**

- **No working links.** An invitation (organization or reviewer) has no link that acts: the person signs in with the
  address it was sent to.
- **Sender addresses.** An enquiry or introduction request never carries the sender's address. Only the introduction
  emails, sent after the person accepts, carry the other side's address.
- **Dates.** Dates are written in Vietnam time (`Asia/Ho_Chi_Minh`):
  - `editableUntil` is written as `d MMM yyyy, HH:mm` followed by ` ICT`;
  - a reviewer invitation's `expiresOn` is written as `d MMM yyyy`.
- **Language.** All email is written in English.

## Templates

- **Defaults.** Each kind's default wording is a file, `notification/templates/<kind>.md`. The file starts with a
  `subject:` line, then a `---` line, then the Markdown body. `DefaultTemplates` reads every file at startup and
  refuses to start when one is missing or fails the checks an operator's edit must pass.
- **Wording in use.** `EmailTemplates.current` uses the `email_template` row of the kind when one exists, and the
  default otherwise. A kind that cannot be edited always uses the default. Resetting a kind deletes its row.
- **Syntax.** JMustache without logic (`TemplateSyntax`):
  - A tag names a value. A section shows its text when the value is present; an inverted section shows its text when
    the value is absent.
  - Values are read only as map entries, never by reflection.
  - These are refused: unescaped output (`{{{` and `{{&`), partials, delimiter changes and the inheritance tags
    (`{{$`, `{{<`). A template cannot include another template.
- **Order of rendering.** The Markdown is converted (commonmark, with HTML escaped and URLs sanitized) before the
  values are filled in. A value is HTML-escaped and its line breaks become `<br>`, so a value can never become markup
  or a link.
- **Styled lines.** In the HTML:
  - a paragraph that is only bold text is shown in a highlighted box (the sign-in code);
  - a paragraph that is only a link is shown as a button in the accent colour.
- **Layout.** `EmailRenderer` places the body in `notification/layout.html`. The layout is table-based with inline
  styles. It shows the GenAI Fund logo from `<siteUrl>/brand/genaifund-logo.png`, a dark footer band with
  `<siteUrl>/brand/genaifund-logo-white.png` and the site's host, a preheader of the first 110 characters of the text,
  and the footer note.
- **Quotes.** A kind's quote, when present, follows the text under the label "From GenAI Fund" (for `note`) or
  "Their message".
- **Plain-text part.** Every email also has a plain-text part. It ends with "The BeyondPilot team at GenAI Fund" and
  the footer note.
- **Checks.** A template has problems (`TemplateProblem.Type`) when:
  - `SYNTAX`: it does not parse, or it uses a forbidden tag;
  - `UNKNOWN_VARIABLE`: it names a variable the kind does not offer (quoted variables are not offered);
  - `MISSING_VARIABLE`: it leaves out a required variable, in the subject and the body together;
  - `SUBJECT_LINE`: the subject is empty or runs over one line.

  A rendered subject is collapsed to one line.

## Sending

`email_message` is both the queue and the log. Each row keeps the email exactly as it was rendered when it was queued:
`subject`, `html` and `text`.

- **Queued in the caller's transaction.** Every method of `EmailService` except `sendSignInCode` is `@Transactional`.
  It renders the email, inserts a `queued` row and publishes `EmailQueued(messageId)`.
  - A change that rolls back leaves no row and sends nothing.
  - A failure to deliver never undoes the caller's change.
- **Handed over after commit.** `EmailDelivery.on(EmailQueued)` is an `@ApplicationModuleListener` that runs without
  a transaction. Its publication is kept in Spring Modulith's registry, and
  `republish-outstanding-events-on-restart: true` runs an undelivered one again on the next start.
- **Claims.** A sender claims a row with an `UPDATE`:
  - it takes the row only while it is `queued` and due;
  - it moves `next_attempt_at` forward by a lease of 5 minutes;
  - it counts the attempt in `attempts`.

  The sweep claims with `for update skip locked`, so no two senders take the same message.

- **Retry sweep.** `EmailDelivery.sweep` runs every minute, starting 30 seconds after startup.
  - It first fails every message still `queued` 24 hours after it was created, with `last_error = expired`.
  - It then claims up to 100 due messages, oldest due first.
  - A temporary failure is tried again 1, 5, 15 and 30 minutes after the first four attempts, then every hour.
  - A permanent failure marks the message `failed` at once.
- **Purge.** `EmailDelivery.purge` runs daily at 03:15 Vietnam time. It deletes messages created more than 90 days
  ago, and their events with them.
- **Failure reasons.** `DeliveryFailure` is typed, and `last_error` stores its value, never a provider's text.

| Value                                                          | Temporary |
| -------------------------------------------------------------- | --------- |
| `not_configured`, `authentication`, `throttled`, `unavailable` | yes       |
| `rejected`, `invalid_recipient`, `suppressed`, `expired`       | no        |

- **No provider.** With no provider configured, email waits in the queue as `not_configured` until one is configured
  or the day runs out.
- **Statuses.** `queued`, `sent`, `delivered`, `bounced`, `complained`, `failed`, `skipped`.
  - `skipped` is a message to a suppressed address, which is never handed over (`last_error = suppressed`).
  - A report only moves a status forward: `delivered` follows `sent`; `bounced` or `complained` follows `sent` or
    `delivered`.
- **Sign-in code.** `sendSignInCode` runs without a transaction and sends in the caller's thread through
  `EmailDelivery.sendNow`, with no retry.
  - The log keeps the email with the code replaced by `••••••`.
  - When the address is suppressed, or the send fails, it throws `NOTIFICATION_EMAIL_NOT_SENT` (`SERVICE_UNAVAILABLE`).
    `identity` turns that into `503` with `Retry-After`.
  - `SignInCodeMail` is a synchronous `@EventListener`, not an `@ApplicationModuleListener`, so the code never reaches
    the event publication registry.
- **Logging.** Events are named `notification.email.sent`, `retrying`, `failed`, `skipped`, `expired`, `purged`,
  `reported`, `test_sent` and `test_failed`. They carry the message id, kind, provider and `error_code`, never the
  recipient or the content.

## Providers

`EmailProvider` is `ses`, `resend` or `smtp`. `EmailAdapterRegistry` resolves the `EmailAdapter` for each one, and
startup fails when a provider has no adapter, or has two
([interchangeable implementations](../conventions.md#interchangeable-implementations-strategy-behind-a-registry)).
The provider used is the one saved in `email_settings`. Nothing about delivery comes from the environment.

| Provider   | Adapter              | Sends with                                                                                                                                                 | Message id                | Reports delivery |
| ---------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ---------------- |
| Amazon SES | `SesEmailAdapter`    | AWS SDK `SesV2Client` in the region of the settings. It tags `kind` and uses the configuration set when one is set                                         | SES's `messageId`         | yes              |
| Resend     | `ResendEmailAdapter` | Resend Java SDK at `beyondpilot.notification.resend.api-url` (default `https://api.resend.com`). It tags `kind`, and the message id is the idempotency key | Resend's id               | yes              |
| SMTP       | `SmtpEmailAdapter`   | Spring `JavaMailSenderImpl` with `starttls` (required), `tls` (`smtps`) or `none`, server identity checked unless `none`, 10-second timeouts               | `<messageId@beyondpilot>` | no               |

- **Errors.** Each adapter maps the provider's errors to a `DeliveryFailure`:
  - 401 or 403 is `authentication`;
  - 429 or a throttling error is `throttled`;
  - a 5xx error or an unreachable provider is `unavailable`;
  - any other refusal is `rejected`;
  - an SMTP recipient the server refuses is `invalid_recipient`.
- **Clients.** An adapter keeps one client for the last connection it was given, and builds a new one when the
  connection changes.

## Settings and secrets

`email_settings` holds one row:

- the provider and the sender (`from_name`, `from_address`, `reply_to`);
- each provider's connection;
- the SES events topic and the Resend webhook secret;
- the appearance (`accent_color`, `footer`);
- `version`, and who changed the row last.

**Secrets.** `smtp_password`, `ses_secret_access_key`, `resend_api_key` and `resend_webhook_secret` are sealed by
`SecretBox`:

- each field is encrypted on its own with AES-256-GCM (`AesGcmBytesEncryptor`) and a random IV;
- the key is `beyondpilot.notification.encryption-key` (`BEYONDPILOT_NOTIFICATION_ENCRYPTION_KEY`), 32 bytes in Base64.
  A key of any other length stops startup;
- without a key, no secret can be stored or read:
  - a save that brings a secret fails with `NOTIFICATION_ENCRYPTION_KEY_MISSING`;
  - a provider whose secret cannot be opened does not send.

The API never returns a secret, only `passwordSet`, `secretAccessKeySet`, `apiKeySet` and `webhookSecretSet`. The
`toString` of every connection, request and reporting record leaves secrets out.

**Rules for saving:**

- **A secret left empty keeps the stored one**, but only while what it belongs to is unchanged:
  - SMTP: the same host, port and username;
  - SES: the same region and access key id.

  Otherwise the secret must be entered again, so a stored secret never goes to a server it was not given for.

- **A complete connection is required.** A save or test must describe one for the chosen provider, or it fails with
  `NOTIFICATION_SETTINGS_INCOMPLETE`:
  - SMTP needs a host and a port, and a password when there is a username;
  - SES needs a region, an access key id and a secret;
  - Resend needs an API key.
- **Optimistic concurrency.** Settings and appearance are saved against the `version` they were read at. A stale
  version fails with `NOTIFICATION_SETTINGS_CHANGED`.
- **Ready to send.** `DeliverySettings.delivery()` is empty unless a provider and a sender address are set and the
  connection can be built. `fromName` defaults to `BeyondPilot`. The settings response reports this as `ready`, and
  whether the key is present as `encryptionReady`.
- **Appearance.**
  - `accentColor` is a six-digit hex colour, stored in upper case; the default is `#0070C0`.
  - `footer` is plain text of at most 500 characters; a default note applies until one is saved.
  - The database checks the colour's form as well.

## Setup checklist

`GET …/settings/checks` asks the saved provider whether email can leave from the sender's domain. The domain is the
part of the from address after `@`, in lower case. Nothing in the answer is stored. It fails with
`NOTIFICATION_SETTINGS_INCOMPLETE` while no provider and sender are saved.

- **Steps.** `EmailSetup.Step`: `credentials`, `domain_added`, `domain_verified`, `dkim`, `mail_from`,
  `production_access`, `sending_enabled`. Each step is in the state `ok`, `pending`, `failed` or `unknown`.
- **SES.** It reads the account (`sending_enabled`, and `production_access`, which is `pending` in the sandbox) and
  the domain's identity. The records it lists:
  - three Easy DKIM `CNAME` records, `<token>._domainkey` → `<token>.dkim.amazonses.com`;
  - when a MAIL FROM domain is set, an `MX` record to `feedback-smtp.<region>.amazonses.com` (priority 10) and a TXT
    record `v=spf1 include:amazonses.com ~all`.
- **Resend.** It finds the domain among the account's domains, reads its status, and lists each record Resend reports
  with its own state.
- **SMTP.** It has no API to ask: no checks and no records. The test email is the check.
- **DMARC.** For SES and Resend, a `TXT` record `_dmarc` with `v=DMARC1; p=none;` (state `unknown`) is added when the
  provider lists none.
- **Hosts.** A record's host is written relative to the domain, with `@` for the domain itself.
- **Limits.** When the provider cannot be asked everything, `limit` says why:
  - `permission_missing`: a key or user that may only send, such as Resend's restricted key or a user without SES read
    rights;
  - `credentials_refused`;
  - `unreachable`.

  The checks the provider did answer are kept.

## Delivery reports and suppressions

Providers post reports to `POST /api/notification/email/events/resend` and `POST /api/notification/email/events/ses`.
These paths are open without a session and are exempt from the CSRF header check (`CsrfHeaderFilter.PROVIDER_REPORTS`).
Nothing in a report is read before its signature is checked. A report that does not verify fails with
`NOTIFICATION_EVENT_REFUSED`.

- **Resend.**
  - The Svix signature is verified with the stored webhook secret. With no secret stored, every report is refused.
  - `email.delivered`, `email.bounced` (a bounce of type `Transient` is a soft bounce) and `email.complained` are
    applied. Other types are ignored.
  - The `svix-id` header identifies the report.
- **SES through SNS** (`SnsMessages`, following AWS's signature rules):
  - **Settings needed.** The region and `ses_events_topic_arn` must be set.
  - **Certificate.** The signing certificate must be an HTTPS `.pem` on `sns.<region>.amazonaws.com`. It is at most
    16 KiB, valid now, and cached by address.
  - **Signature.** Versions 1 (SHA1withRSA) and 2 (SHA256withRSA) are accepted.
  - **Topic.** A message from any topic other than the one set is refused.
  - **Subscription.** A `SubscriptionConfirmation` is confirmed by a GET to its `SubscribeURL`, which must also be on
    the SNS host. When that GET fails, the result is `NOTIFICATION_SUBSCRIPTION_NOT_CONFIRMED` and SNS asks again.
  - **Events.** `Delivery`, `Bounce` (`Permanent` is a bounce; anything else is a soft bounce) and `Complaint` are
    applied.
- **Applying a report** (`DeliveryReports`):
  - **Unknown messages.** A report about a message BeyondPilot does not know, matched by provider and provider
    message id, is ignored.
  - **Recorded once.** Each report is recorded once in `email_event` (`source_id` is unique). `detail` keeps only a
    provider code of up to 40 letters, never free text.
  - **Suppression.** A permanent bounce or a complaint suppresses the recipient (`bounce` or `complaint`, with the
    message that caused it).
  - **Soft bounces.** A soft bounce is recorded and suppresses nothing.
- **Suppressions.** `email_suppression` keeps addresses in lower case, with the reason `bounce`, `complaint` or
  `manual`.
  - **Effect.** Every kind of email to a suppressed address is logged as `skipped`, and a sign-in code to it fails.
  - **Operators.** Operators add (`manual`) and remove addresses. Adding one already suppressed fails with
    `NOTIFICATION_SUPPRESSION_EXISTS`; removing one that is not fails with `NOTIFICATION_SUPPRESSION_NOT_FOUND`.
  - **Listing.** The list is newest first, 25 per page, filtered by `reason` and by `q` (contains, ignoring case).

## Activity

`EmailActivity` is the operators' reading of `email_message`.

- **List.** 50 messages per page, newest first.
  - **Cursors.** Keyset cursors are `<microseconds since epoch>_<id>`. `before` reads towards the past, and `after`
    reads towards the present.
  - **Filters.** `from`, `kind`, `status`, and `q`, which matches recipient or subject, contains, ignoring case.
  - **Counts.** The period's counts are filtered by `from` and `kind` only:
    - `total`;
    - `sent` (sent, delivered, bounced or complained);
    - `delivered`, `bounced` and `complained`;
    - `notSent` (failed or skipped).
- **One message.** The message as it was sent (HTML and text), with:
  - its attempts, provider, provider message id and `lastError`;
  - its events;
  - its suppression, if any;
  - `resendable`, which is true only when the message is not a sign-in code, its address is not suppressed, and it is
    not still `queued`.
- **Resend.** Resending queues the stored content again as a new message to the same address, and records
  `email.resend`. It fails with:
  - `NOTIFICATION_MESSAGE_NOT_RESENDABLE` for a sign-in code;
  - `NOTIFICATION_ADDRESS_SUPPRESSED` for a suppressed address;
  - `NOTIFICATION_MESSAGE_NOT_FOUND` for an unknown id.

## Test emails

A test can be sent from Settings or from a template.

- **From Settings.** The test goes through the connection as the form holds it, saved or not. Its subject is
  "BeyondPilot email works".
- **From a template.** The test renders the draft with the kind's sample values and sends it through the saved
  settings, with the subject prefixed `[Test] `. A draft with problems fails with `NOTIFICATION_TEMPLATE_INVALID`.
- **Not logged.** A test is sent straight to the provider and is not written to `email_message`. The answer is
  `EmailTestResponse` (`recipient`, `sent`, `failure`). A provider failure is reported in the answer and is not
  raised as an error.
- **Recipient.** The `to` query parameter names the recipient. Left out, the test goes to the operator's own address.
  `TestRecipients.admit` enforces these rules:
  - **One plain address.** The address must match `[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+` and be at
    most 254 characters. A value a mail library would read as several recipients, or as a name and an address, fails
    with `NOTIFICATION_TEST_RECIPIENT_INVALID`.
  - **Never to a suppressed address.** That fails with `NOTIFICATION_ADDRESS_SUPPRESSED`, including for the
    operator's own address.
  - **Hourly limit for other addresses.** A test to an address other than the operator's own counts against a limit
    of 10 per operator per hour (`HOURLY_LIMIT`). Past the limit it fails with `NOTIFICATION_TEST_LIMIT_REACHED`
    (`LIMIT_EXCEEDED`).
    - The count is the operator's `email.test_send` audit events in the last hour.
    - The count and the new record run in one transaction, under a PostgreSQL advisory lock keyed
      `email-test:<accountId>` (`pg_advisory_xact_lock`). Tests asked at once therefore take turns.
  - **Audited.** A test to another address records `email.test_send` before it is sent, with the address as the
    resource and `subject` set to `settings` or to the kind. A test that then fails to leave stays recorded.
  - **Tests to oneself** are neither counted nor recorded.

## Admin › Email API

Every path below requires a session and an operator: `IdentityService.requireOperator`, otherwise
`IDENTITY_OPERATOR_REQUIRED`. The base path is `/api/notification/admin/email`.

| Method and path                   | Contract                                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /settings`                   | `EmailSettings`, with no secrets; includes the events URLs `<siteUrl>/api/notification/email/events/ses` and `/resend`                                        |
| `PUT /settings`                   | Saves provider, sender, connections, SES events topic and Resend webhook secret against `version`; records `email.settings_update`                            |
| `PUT /settings/appearance`        | Saves accent colour and footer against `version`; records `email.appearance_update`                                                                           |
| `POST /settings/test?to=`         | Sends a test through the settings in the body                                                                                                                 |
| `GET /settings/checks`            | The setup checklist and DNS records of the saved provider                                                                                                     |
| `GET /templates`                  | Every kind that can be edited, in catalog order, with its group, the subject in use, and whether it was edited                                                |
| `GET /templates/{kind}`           | The wording in use, the default, the variables with their samples, and `version` (null while the default is in use)                                           |
| `PUT /templates/{kind}`           | Replaces the wording; the subject is at most 200 characters, the body at most 20,000; records `email.template_update`                                         |
| `DELETE /templates/{kind}`        | Puts the default back; records `email.template_reset` only when there was a row to delete                                                                     |
| `POST /templates/{kind}/preview`  | Renders a draft with sample values and lists its problems. With problems, the default is rendered. An appearance in the body is previewed without being saved |
| `POST /templates/{kind}/test?to=` | Sends the draft with sample values as a test                                                                                                                  |
| `GET /messages`                   | A page of the log with the period's counts                                                                                                                    |
| `GET /messages/{id}`              | One message, its events, its suppression and whether it can be resent                                                                                         |
| `POST /messages/{id}/resend`      | `201` with the new message's id                                                                                                                               |
| `GET /suppressions`               | A page of suppressed addresses                                                                                                                                |
| `POST /suppressions`              | `201`; adds an address manually; records `email.suppression_add`                                                                                              |
| `DELETE /suppressions/{address}`  | `204`; records `email.suppression_remove` with the earlier `reason`                                                                                           |

**Templates.** A kind that does not exist fails with `NOTIFICATION_TEMPLATE_NOT_FOUND`, and `application_outcome`
fails with `NOTIFICATION_TEMPLATE_NOT_EDITABLE`.

- **Saving.** A save sends the `version` it read, or null when the default was in use.
- **Conflicts.** A mismatch fails with `NOTIFICATION_TEMPLATE_CHANGED`. So does a save that loses a race on the row's
  JPA `@Version`.

**Web.** The screens are under `/admin/email`, which opens on `templates`. The other pages are `templates/[kind]`,
`activity`, `activity/[id]`, `suppressions`, `settings` and `appearance`. Each page checks the operator role on the
server.

## Error codes

`NotificationErrorCode`. Each category maps to one HTTP status ([API errors](../conventions.md#api-errors)).

| Code                                      | Category              |
| ----------------------------------------- | --------------------- |
| `NOTIFICATION_EMAIL_NOT_SENT`             | `SERVICE_UNAVAILABLE` |
| `NOTIFICATION_SETTINGS_INCOMPLETE`        | `VALIDATION`          |
| `NOTIFICATION_SETTINGS_CHANGED`           | `CONFLICT`            |
| `NOTIFICATION_ENCRYPTION_KEY_MISSING`     | `SERVICE_UNAVAILABLE` |
| `NOTIFICATION_TEMPLATE_NOT_FOUND`         | `NOT_FOUND`           |
| `NOTIFICATION_TEMPLATE_NOT_EDITABLE`      | `CONFLICT`            |
| `NOTIFICATION_TEMPLATE_INVALID`           | `VALIDATION`          |
| `NOTIFICATION_TEMPLATE_CHANGED`           | `CONFLICT`            |
| `NOTIFICATION_TEST_RECIPIENT_INVALID`     | `VALIDATION`          |
| `NOTIFICATION_TEST_LIMIT_REACHED`         | `LIMIT_EXCEEDED`      |
| `NOTIFICATION_MESSAGE_NOT_FOUND`          | `NOT_FOUND`           |
| `NOTIFICATION_MESSAGE_NOT_RESENDABLE`     | `CONFLICT`            |
| `NOTIFICATION_ADDRESS_SUPPRESSED`         | `CONFLICT`            |
| `NOTIFICATION_SUPPRESSION_NOT_FOUND`      | `NOT_FOUND`           |
| `NOTIFICATION_SUPPRESSION_EXISTS`         | `CONFLICT`            |
| `NOTIFICATION_EVENT_REFUSED`              | `NOT_PERMITTED`       |
| `NOTIFICATION_SUBSCRIPTION_NOT_CONFIRMED` | `SERVICE_UNAVAILABLE` |

## Audit actions

Recorded through `AuditTrail.record` in the transaction of the change. A test is recorded in a transaction of its own
before it is sent. The actor is the operator. No secret is a detail.

| Action                     | Resource                         | Details                            |
| -------------------------- | -------------------------------- | ---------------------------------- |
| `email.settings_update`    | `email_settings` `1`             | `provider`                         |
| `email.appearance_update`  | `email_settings` `1`             | none                               |
| `email.template_update`    | `email_template`, the kind       | none                               |
| `email.template_reset`     | `email_template`, the kind       | none                               |
| `email.suppression_add`    | `email_address`, the address     | none                               |
| `email.suppression_remove` | `email_address`, the address     | `reason`                           |
| `email.resend`             | `email_message`, the original id | none                               |
| `email.test_send`          | `email_address`, the address     | `subject` (`settings` or the kind) |

## Configuration

`NotificationProperties` (`beyondpilot.notification`):

| Property         | Environment                               | Meaning                                                                                                                                          |
| ---------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `encryption-key` | `BEYONDPILOT_NOTIFICATION_ENCRYPTION_KEY` | Seals provider secrets; empty by default, which means no secret is stored or read                                                                |
| `site-url`       | `BEYONDPILOT_SITE_URL`                    | Required. Logo and site links in emails, and the events URLs; `http://localhost:3000` by default, with no default under the `production` profile |
| `resend.api-url` | none                                      | Resend's API, `https://api.resend.com` by default                                                                                                |

A fresh database sends no email until an operator chooses a provider ([ADR 0005](../decisions/0005-operators-run-email-delivery.md)).
