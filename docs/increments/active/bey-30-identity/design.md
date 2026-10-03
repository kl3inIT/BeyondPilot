# Identity: sign-in, sessions and the operator role

Status: backend implemented on 3 October 2026; the web screens follow ([plan](plan.md)). It is the first slice of the [Phase 1 domain model](../bey-22-phase-1-domain-model/design.md), whose boundary discovery it relies on.

## What a person can do

- Sign in with Google, or with a link sent to an email address. There is no password.
- Come back within 30 days of their last visit without signing in again.
- Reach the same account whichever way they sign in: an address is one account.
- Sign out.

GenAI Fund staff are operators. The first operators are the addresses listed in the server configuration; a screen where operators grant and withdraw the role is the next step of this increment and is not built yet.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Where sign-in is implemented | Spring Security in this application: OAuth 2.0 login for Google, one-time-token login for the link, Spring Session JDBC for the session | No second system to run; both methods are framework features |
| Accounts and providers | `identity_account` and `identity_external_identity`, the shape most products use (a user table and a table of external logins) | Another provider later is a new value of `provider`, not a new structure |
| One address, one account | A link redemption and a Google sign-in with the same verified address reach the same account. A Google sign-in whose address Google has not verified cannot create or join an account | Both prove ownership of the address; a second, empty account would look like lost work |
| Returning Google users | Found by Google's subject, so an address changed at Google keeps its account | The subject is the stable identifier; the address is not |
| Address comparison | Case-insensitive through a unique index on `lower(email)`; the address is stored as written | `citext`, named in the first model draft, compares case-sensitively when a JDBC driver sends the parameter as `varchar`, and needs an extension |
| Link lifetime | 15 minutes, single use | Long enough for a slow mailbox, short enough that an old email opens nothing. Spring Security's default of 5 minutes is too short |
| Session | Ends 30 days after the last request. The cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` in deployed environments | Applicants return several times before a deadline |
| What the session holds | The account identifier only (`Actor`). Role and status are read from the database when needed | A withdrawn role or a disabled account takes effect at once |
| First operators | `BEYONDPILOT_IDENTITY_OPERATOR_EMAILS`: an address in the list becomes an operator when it signs in | Several staff from the first day, in every environment, without a setup screen |
| Enterprise single sign-on | Not built | Not asked for; the people signing in are providers, builders and innovation staff |

## How the web application uses it

The web application is the only client and shares the origin, so no endpoint answers with a page.

| Step | Request | Answer |
| --- | --- | --- |
| Ask for a link | `POST /ott/generate` with form fields `username` (the address), and optionally `returnTo` and `locale` (`vi`) | `204` whether or not the address has an account. `400` for a malformed address, `429` when the address already holds three working links, `503` when the email could not be sent |
| Open the link | The email links to `/sign-in/link?token=…&returnTo=…` on the web application (`/vi/sign-in/link` for Vietnamese). That page posts the token | — |
| Redeem | `POST /login/ott` with form field `token` | `204` and the session cookie; `401` for a used, expired or unknown token, or a disabled account |
| Google | The browser opens `/oauth2/authorization/google?returnTo=…` | A redirect to Google, then back to `returnTo`, or to `/sign-in?error=google` |
| Who am I | `GET /api/identity/me` | `200` with `id`, `email`, `displayName`, `role`; `401` without a session; `403` `IDENTITY_ACCOUNT_DISABLED` |
| Sign out | `POST /logout` | `204` |

- Every request that changes state carries `X-BeyondPilot-CSRF: 1`; without it the answer is `403`.
- A path under `/api` needs a session unless a line in `SecurityConfiguration` opens it.
- `returnTo` is kept only when it is a path of this origin. The link page of the web application checks it again before following it, because anyone can write a link.
- Posting the token, instead of signing in on the `GET` of the link, keeps a mail scanner that prefetches links from using it up.
- Every refusal is an RFC 9457 problem with the request identifier.

## Modules

| Module | Holds | Depends on |
| --- | --- | --- |
| `identity` | `IdentityService`, `Actor`, `@CurrentActor`, the failure codes; `signin` (the Spring Security adapters), `web`, `dto`, `persistence` | `notification` |
| `notification` | `EmailService` and the wording of each email in English and Vietnamese | — |
| `config` | `SecurityConfiguration`, the CSRF header check, the return path of the Google round trip | — |

`config` names no module type: `identity` publishes its adapters as beans of Spring Security's own interfaces, which the filter chain receives. Email goes over SMTP, so the mail provider is configuration and needs no adapter.

## Data

`V1__identity_create_accounts_tokens_and_sessions.sql`:

| Table | Columns |
| --- | --- |
| `identity_account` | `id`, `email` (unique on `lower(email)`), `display_name`, `status` (`active`, `disabled`), `platform_role` (`user`, `operator`), `last_login_at`, `version`, `created_at`, `updated_at` |
| `identity_external_identity` | `id`, `account_id`, `provider` (`google`), `subject`, `created_at`; unique on provider and subject |
| `one_time_tokens` | Spring Security's table: `token_value`, `username` (the address), `expires_at` |
| `spring_session`, `spring_session_attributes` | Spring Session's tables |

## Known limits

- The return from Google is not covered by an automated test, because it needs Google. It is checked by hand on an environment with a real OAuth client.
- The link limit is per address. There is no limit per network address yet, so one sender can still ask for links to many addresses; a limit at the reverse proxy belongs to the deployment work.
- One-time tokens are stored as issued, as Spring Security's JDBC service does. They are single use and live 15 minutes.
- The application trusts `X-Forwarded-*` headers (`server.forward-headers-strategy: framework`), which is correct only behind the web application or a reverse proxy; the backend port is never exposed directly.
