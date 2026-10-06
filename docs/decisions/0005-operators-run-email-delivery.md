# ADR 0005: Operators run email delivery, and identity hands over sign-in codes by event

- Status: Accepted, implementation started 2026-10-06
- Date: 2026-10-06
- Decision owner: BeyondPilot team

## Context

`notification` sent seventeen kinds of email over SMTP from the caller's thread, configured from the environment, and `identity` depended on it to send sign-in codes. Production had no provider, and nothing recorded what was sent. [BEY-68](../increments/active/bey-68-email-delivery/design.md) gives operators Admin › Email: they choose the provider (Amazon SES, Resend or SMTP), edit the wording, read what was sent and manage suppressed addresses.

Those screens need the caller, the operator role and the operator's name and address, which belong to `identity`. With `identity` depending on `notification`, `notification` could not depend on `identity` without a cycle.

## Decision

- **`notification` depends on `identity`; `identity` no longer depends on `notification`.** `identity` publishes `SignInCodeRequested(email, code, validFor)` in its root package, and `notification` sends it from a synchronous `@EventListener` before the request is answered. A failure comes back to the publisher as a `BusinessException` of category `SERVICE_UNAVAILABLE`, which `identity` turns into `503` with `Retry-After` without naming a `notification` type.
- **That event is the one exception to [events between modules](../conventions.md#events-between-modules).** It carries a secret, the code in clear, because the code exists in clear only at that moment; it is handled synchronously and never by `@ApplicationModuleListener`, so it never reaches the event publication registry; and its `toString` leaves the code out.
- **Who delivers email is configuration operators keep in the database**, not environment variables: one `email_settings` row. Secrets in it are encrypted field by field with AES-256-GCM under `BEYONDPILOT_NOTIFICATION_ENCRYPTION_KEY`, the one email value the environment supplies, and are never returned by the API.
- **Providers sit behind `EmailAdapterRegistry`**, a closed family keyed by `EmailProvider`, as [the interchangeable-implementations pattern](../conventions.md#interchangeable-implementations-strategy-behind-a-registry) prescribes.

## Alternatives considered

- **Keep the edge and guard the email paths in the filter chain**, as [ADR 0004](0004-the-filter-chain-keeps-the-audit-log-for-operators.md) does for the audit log. It covers the role but not the operator's name and address, which the audit record, "edited by" and "send a test to me" need; that would take a second bean contract by name between `identity` and `notification`.
- **A second module for the email administration.** Both modules would share one language, one owner of the tables and one lifecycle, which [boundary discovery](../conventions.md#boundary-discovery) keeps together.
- **An interface in `identity` that `notification` implements to send the code.** One implementation by nature, which [change design](../conventions.md#change-design) refuses.
- **Provider configuration from the environment**, as Discourse and Mastodon do. A change of provider would need a deployment; the owner chose operator configuration, as Keycloak, ThingsBoard and WP Mail SMTP offer.

## Consequences

- A fresh database sends no email until an operator configures a provider. Operators can sign in with Google meanwhile.
- Losing or replacing the encryption key makes the stored secrets unreadable; an operator enters them again.
- A new kind of email that someone requests and waits for on a screen follows the sign-in code's path only if it carries a secret; every other email is queued through `EmailService`.
