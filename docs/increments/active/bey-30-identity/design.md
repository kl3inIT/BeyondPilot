# Identity: sign-in, sessions and the operator role

Status: backend implemented on 3 October 2026; the web screens follow ([plan](plan.md)). It is the first slice of the [Phase 1 domain model](../bey-22-phase-1-domain-model/design.md), whose boundary discovery it relies on.

## What a person can do

- Sign in with Google, or with a six-digit code sent to an email address. There is no password.
- Come back within 30 days of their last visit without signing in again.
- Reach the same account whichever way they sign in: an address is one account.
- Sign out.

GenAI Fund staff are operators. The first operators are the addresses listed in the server configuration; a screen where operators grant and withdraw the role is the next step of this increment and is not built yet.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Where sign-in is implemented | Spring Security in this application: OAuth 2.0 login for Google, one-time-token login for the emailed code, Spring Session JDBC for the session | No second system to run; both methods are framework features |
| A code, not a link | The email carries six digits that the person types into the screen that is waiting for them | A link signs in whoever opens it: sent on by someone else, it signs the reader into the sender's account without their noticing. A code is what most comparable products use (the research is in the [main-flows increment](../bey-27-main-flows-design/research.md)); it also works when the email is read on another device, and a mail scanner has nothing to open |
| The code is tied to the browser that asked | The challenge identifier stays in that browser's session; the email carries only the code. Neither works alone | A code handed to another person does nothing in their browser, and nobody can guess at, or use up, a code from elsewhere |
| Guessing | A code takes five guesses, each charged in the database before it is looked at, works once and for 15 minutes, and is stored as a salted hash. An address holds at most three working codes. Fifteen wrong codes in a day, over all codes of an address, stop new codes for that address until the day has passed | Six digits are guessable given enough tries; the limits make the tries too few. The daily stop trades a risk of take-over for a risk of someone blocking an address from code sign-in for a day; Google sign-in still works for it |
| Accounts and providers | `identity_account` and `identity_external_identity`, the shape most products use (a user table and a table of external logins) | Another provider later is a new value of `provider`, not a new structure |
| One address, one account | A typed code and a Google sign-in with the same verified address reach the same account. A Google sign-in whose address Google has not verified cannot create or join an account | Both prove ownership of the address; a second, empty account would look like lost work |
| Returning Google users | Found by Google's subject, so an address changed at Google keeps its account | The subject is the stable identifier; the address is not |
| Address comparison | Case-insensitive through a unique index on `lower(email)`; the address is stored as written | `citext`, named in the first model draft, compares case-sensitively when a JDBC driver sends the parameter as `varchar`, and needs an extension |
| Session | Ends 30 days after the last request. The cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` in deployed environments | Applicants return several times before a deadline |
| What the session holds | The account identifier only (`Actor`). Role and status are read from the database when needed | A withdrawn role or a disabled account takes effect at once |
| First operators | `BEYONDPILOT_IDENTITY_OPERATOR_EMAILS`: an address in the list becomes an operator when it signs in | Several staff from the first day, in every environment, without a setup screen |
| Enterprise single sign-on | Not built | Not asked for; the people signing in are providers, builders and innovation staff |

## How the web application uses it

The web application is the only client and shares the origin, so no endpoint answers with a page.

| Step | Request | Answer |
| --- | --- | --- |
| Ask for a code | `POST /ott/generate` with form fields `username` (the address) and optionally `locale` (`vi`) | `204` whether or not the address has an account, and the session cookie that holds the challenge. `400` for a value that is not a plain address, `429` when the address may not have another code yet, `503` when the email could not be sent; the last two carry `Retry-After` |
| Type the code | `POST /login/ott` with form field `code`, from the same browser | `204` and a new session cookie. `401` wrong code, `410` no code is waiting in this browser, or it has expired or been used, `429` too many wrong codes, `403` the account is disabled |
| Google | The browser opens `/oauth2/authorization/google?returnTo=…` | A redirect to Google, then back to `returnTo`, or to `/sign-in?error=google` |
| Who am I | `GET /api/identity/me` | `200` with `id`, `email`, `displayName`, `role`; `401` without a session; `403` `IDENTITY_ACCOUNT_DISABLED` |
| Sign out | `POST /logout` (a `GET` does nothing) | `204` |

- Every request that changes state carries `X-BeyondPilot-CSRF: 1`; without it the answer is `403`.
- A path under `/api` needs a session unless a line in `SecurityConfiguration` opens it.
- `returnTo` matters only to the Google round trip, where it is kept when it is a path of this origin, judged the way a browser reads it. For the code, the web page itself knows where the person came from.
- Every refusal is an RFC 9457 problem with the request identifier.

## Modules

| Module | Holds | Depends on |
| --- | --- | --- |
| `identity` | `IdentityService`, `Actor`, `@CurrentActor`, the failure codes; `signin` (the Spring Security adapters), `web`, `dto`, `persistence` | `notification` |
| `notification` | `EmailService` and the wording of each email in English and Vietnamese | — |
| `config` | `SecurityConfiguration`, the CSRF header check, the return path of the Google round trip | — |

`config` names no module type: `identity` publishes its adapters as beans of Spring Security's own interfaces (`OneTimeTokenService`, `OneTimeTokenGenerationSuccessHandler`, `AuthenticationConverter`, `UserDetailsService`, the OIDC user service), which the filter chain receives. Email goes over SMTP, so the mail provider is configuration and needs no adapter.

## Data

`V1__identity_create_accounts_codes_and_sessions.sql`:

| Table | Columns |
| --- | --- |
| `identity_account` | `id`, `email` (unique on `lower(email)`), `display_name`, `status` (`active`, `disabled`), `platform_role` (`user`, `operator`), `last_login_at`, `version`, `created_at`, `updated_at` |
| `identity_external_identity` | `id`, `account_id`, `provider` (`google`), `subject`, `created_at`; unique on provider and subject |
| `identity_sign_in_challenge` | `id` (the challenge, kept in the asking browser's session), `email`, `code_hash`, `failed_attempts`, `expires_at`, `created_at` |
| `spring_session`, `spring_session_attributes` | Spring Session's tables |

## Known limits

- The return from Google is not covered by an automated test, because it needs Google. It is checked by hand on an environment with a real OAuth client.
- There is no limit per network address yet, so one sender can still ask for codes to many addresses; a limit at the reverse proxy belongs to the deployment work.
- Someone who knows an address can stop code sign-in for it for a day by typing wrong codes. The alternative, no daily stop, leaves a slow guessing attack open; the choice is recorded in the decisions above.
- The application trusts `X-Forwarded-*` headers (`server.forward-headers-strategy: framework`), which is correct only behind the web application or a reverse proxy; the backend port is never exposed directly.
