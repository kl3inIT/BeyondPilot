# BEY-128 — Brevo as an email provider

> **Completed, 14 October 2026:** delivered and running on staging and production (release 372f259b). What it left open is on its Linear issue.

Status: implemented and tested against a server that answers as Brevo documents ([plan](plan.md)). Nothing here has run against a real Brevo account yet; what that leaves open is listed under [Not verified](#not-verified). The contract that results is in the [email specification](../../../specs/notification.md) and its checks in the [test matrix](../../../tests/notification.md).

## Why

Operators choose who delivers BeyondPilot's email in Admin › Email ([BEY-68](../bey-68-email-delivery/design.md), [ADR 0005](../../../decisions/0005-operators-run-email-delivery.md)). BEY-128 asks for Brevo as a fourth choice beside Amazon SES, Resend and SMTP.

## Outcome

- **Send.** `BrevoEmailAdapter` posts to Brevo's transactional API and keeps Brevo's message id.
- **Delivery reports.** `POST /api/notification/email/events/brevo` takes Brevo's webhook: delivered, bounced and reported as spam move the email's status, and a bounce or a complaint suppresses the address.
- **Setup checklist.** Settings shows whether the sender's domain is added, verified and authenticated at Brevo, and the three DNS records Brevo asks for.
- **Settings.** A Brevo API key and a webhook token, both sealed.

No module boundary changes: everything is inside `notification`, behind the existing `EmailAdapter` and its registry.

## What Brevo documents

Read on developers.brevo.com on 11 October 2026.

| Fact                                                                                                                                                                                                                                                                                                                                                               | Source                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `POST https://api.brevo.com/v3/smtp/email` with the header `api-key`; the body has `sender` (`name`, `email`), `to`, `replyTo`, `subject`, `htmlContent`, `textContent`; `201` answers `messageId`, written as `<201798300811.5787683@relay.domain.com>`                                                                                                           | `/reference/sendtransacemail`                                             |
| An `idempotencyKey` in the body's `headers` map, a UUID kept 30 minutes; a repeated key answers the error `duplicate_parameter` and the request is not processed. The page is about batch sends; the reference of the endpoint shows a different spelling, `Idempotency-Key`, in an example and explains neither                                                   | `/docs/heterogenous-versions-batch-emails`, `/reference/sendtransacemail` |
| Transactional webhook events: `request`, `delivered`, `soft_bounce`, `hard_bounce`, `invalid_email`, `blocked`, `spam`, `deferred`, `click`, `opened`, `unique_opened`, `unsubscribed`, `error`, `proxy_open`. The payload has `event`, `email`, `message-id`, `ts_event` (seconds, UTC), `date`, `reason`; the examples write `message-id` without angle brackets | `/docs/transactional-webhooks`                                            |
| A webhook is protected by an allowlist of Brevo's addresses, by a user and password in the URL, by `auth: { type: "bearer", token }` or by custom headers. Nothing is said about a signature                                                                                                                                                                       | `/docs/secured-webhooks`, `/reference/create-webhook`                     |
| A 4xx other than 429, and any 5xx, ends the retries and the report is dropped. After a 429 Brevo tries again after 10 minutes, 1 hour, 2 hours and 8 hours                                                                                                                                                                                                         | `/docs/retry-mechanism`                                                   |
| `GET /v3/senders/domains/{domainName}` answers `domain`, `verified`, `authenticated` and `dns_records` with `dkim_record`, `brevo_code` and `dmarc_record`, each `type`, `value`, `host_name` and a boolean `status`                                                                                                                                               | `/reference/getdomainconfiguration`                                       |

## Decisions

### The SDK, not a hand-written client

The Resend and SES adapters use their vendors' SDKs, so Brevo's does too: `com.brevo:brevo` 1.1.10, the newest release on Maven Central on 11 October 2026.

- **The risk.** The SDK is generated for OkHttp 4.10. The build already holds two OkHttp artifacts: `okhttp:4.12.0` from the Spring AI model starters and `okhttp-jvm:5.4.0` from `resend-java`. They carry the same classes, and the test JVM loads them from `okhttp-jvm-5.4.0.jar`. Brevo's SDK adds no third version: its `okhttp:4.10.0` resolves to the 4.12.0 already there.
- **The evidence.** `BrevoEmailAdapterTest` runs the SDK on that classpath against a local HTTP server: it sends a request with the key and a JSON body, reads a `201` and a domain, and turns 400, 401, 403, 429, 500 and a closed port into the SDK's `ApiException`. No dependency was aligned, excluded or forced.
- **What it brings.** `gson`, `gson-fire`, `threetenbp`, `swagger-annotations` 1.5 (`io.swagger.annotations`, another package than springdoc's), `javax.annotation-api`, and `logging-interceptor:4.10.0`, which serves the SDK's debugging mode; the adapter leaves that off.
- **Left alone.** Two OkHttp artifacts with the same classes on one classpath is the state of `main`, not of this change. Which one a deployed application loads is decided by the order of the jar's classpath index and is worth settling on its own.

### No idempotency key

Resend's key replays the first answer, so a send retried after a lost answer is delivered once and keeps its id. Brevo's documented key answers a repeated request with an error and no message id. The queue could only read that as a refusal and mark the email failed although it left, and no report could then be matched to it. Whether a request that failed at Brevo also uses up its key for 30 minutes is not documented; if it does, every retry of the queue's first half hour would be refused. The key is also documented for batch sends only, under two spellings. So Brevo is given no key, and a send retried after a lost answer is delivered twice. Adding the key later is one line in `BrevoEmailAdapter.send`, once its behaviour is known from a real account.

### The message id is kept without angle brackets

The send answer writes the id in angle brackets and the examples of the webhook write it without. Both the adapter and the intake drop a surrounding pair, so the two meet whichever form Brevo sends.

### The webhook is recognised by a bearer token

Brevo signs nothing. Of the ways it offers, a bearer token is the one that keeps the secret out of the URL, where proxies and access logs record it.

- **The token** is made up by the operator and entered twice: in Settings and on the webhook in Brevo. It is 32 to 256 characters of `A-Z a-z 0-9 . _ ~ + / = -`, the characters a bearer token may have, so a guessable word is refused. It is sealed by `SecretBox` like the other secrets.
- **The check** is `MessageDigest.isEqual` on the bytes, after the scheme `Bearer` is matched without regard to case. No stored token, no header, another scheme or another token is `NOTIFICATION_EVENT_REFUSED` (403), before the body is parsed.
- **What a token is not.** It does not sign the body: whoever holds it can report anything. It is a shared secret between two operators' consoles, and it is replaced by saving a new one in both places.

### Which events count

| Brevo                                     | BeyondPilot                           |
| ----------------------------------------- | ------------------------------------- |
| `delivered`                               | delivered                             |
| `hard_bounce`, `invalid_email`, `blocked` | bounced; the address is suppressed    |
| `spam`                                    | complained; the address is suppressed |
| everything else, `soft_bounce` included   | ignored                               |

Brevo gives a report no identifier, so `brevo:<event>:<message id>` stands in for one. A message goes to one address, so each kind of report happens to it once, and a report Brevo sends again is recorded once. `reason` is free text and is not kept.

### A failure of ours is answered with 429

Brevo drops a report after a 5xx and tries again only after a 429. So when the database fails while a report is taken (`DataAccessException` or `TransactionException`), the intake throws `NOTIFICATION_REPORT_NOT_TAKEN`, whose category `LIMIT_EXCEEDED` is the one that maps to 429. The mechanism is the existing one, a typed code and the single handler, as `NOTIFICATION_SUBSCRIPTION_NOT_CONFIRMED` answers 503 so that Amazon SNS asks again. The category's name fits loosely: nothing was exceeded. Any other failure stays a 500, and Brevo drops that report.

### The setup checklist

`verified` is the step `domain_verified` and `authenticated` is the step `dkim`. Brevo answers true or false, so false is `pending`, never `failed`. A 404 or a 400 is a domain Brevo does not know, because the key was accepted and the domain is all that was asked; a 401 is refused credentials; a 403 is a key that may not read.

The note under a DMARC record, "the provider does not check it", now shows only for a record whose state is `unknown`: that is the one BeyondPilot adds itself. Brevo lists its own DMARC record with a state.

### The provider cards

Four providers do not fit the row of three, so the cards go two to a row from 640px.

## Not verified

None of this could be checked without a Brevo account.

- That Brevo's bearer authentication sends `Authorization: Bearer <token>`. The documentation names the setting and not the header.
- That the Brevo console, and not only its API, lets an operator set a bearer token on a webhook.
- Whether `message-id` in a real report has angle brackets. Both forms are handled.
- Whether `ts_event` is always present. Without it the report is dated when it arrives.
- The status and the `code` Brevo answers for a domain it does not know (the reference lists `Domain does not exist` under 400 and describes the 404 as "bad request"), for a key that may not read domains, and for a request from an address outside the account's allowlist.
- Whether Brevo lists more DNS records than the three of the reference, such as two DKIM `CNAME` records. The SDK's model has three.
- How the idempotency key behaves on the plain send, and after a request that failed.
- That a real send through `api.brevo.com` is taken and reported.
