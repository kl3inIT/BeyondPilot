# Identity

Who is signed in: accounts, sign-in with Google and with an emailed six-digit code, the session, and the operator
role that GenAI Fund staff hold. Sign-in is Spring Security inside the backend, with no separate identity server. It was
delivered by [BEY-30](../increments/completed/bey-30-identity/design.md), and the operators' account administration by
[BEY-48](../increments/completed/bey-48-admin-accounts/design.md). The code is the `identity` application module,
`backend/src/main/java/ai/genaifund/beyondpilot/identity`; the filter chain that wires its sign-in pieces is
`config.SecurityConfiguration`. The checks that hold this contract are in the [identity matrix](../tests/identity.md).

## Module

- **Published API.** The package root: `IdentityService`, `AccountAdministration`, `Actor`, `@CurrentActor`,
  `Operator`, `Person`, `SignInCodeRequested`, `IdentityProperties`, `IdentityErrorCode` and `IdentityException`.
- **Internal packages.** `signin` holds the Spring Security adapters (the code service, its request guard and limits,
  the code converter and sender, the Google user service, the principals and `SignInConfiguration`); `web` the
  controllers; `dto` the request and response records; `persistence` the entities and repositories.
- **Dependencies.** `@ApplicationModule(type = CLOSED, allowedDependencies = { "audit" })`. `identity` records its
  changes through `audit` ([ADR 0003](../decisions/0003-an-audit-module-that-modules-record-through.md)). It does not
  depend on `notification`: a sign-in code leaves as the event `SignInCodeRequested`
  ([ADR 0005](../decisions/0005-operators-run-email-delivery.md)).
- **Wiring without a module edge.** `config` names no `identity` type. `identity` publishes beans of Spring Security's
  own interfaces (`OneTimeTokenService`, `OneTimeTokenGenerationSuccessHandler`, `AuthenticationConverter`,
  `UserDetailsService`, the OIDC user service, `GenerateOneTimeTokenRequestResolver`, `ClientRegistrationRepository`)
  and the bean `operatorsOnly`, an `AuthorizationManager<RequestAuthorizationContext>`
  ([ADR 0004](../decisions/0004-the-filter-chain-keeps-the-audit-log-for-operators.md)).

### What other modules call

- **`Actor` and `@CurrentActor`.** `Actor(accountId)` is the signed-in account and carries nothing else. `@CurrentActor`
  binds a controller parameter to it and is hidden from the API contract; on a path open to visitors, a visitor who is
  not signed in is bound as `null`.
- **`IdentityService.requireActive(actor)`** refuses an account that is disabled or gone with `IDENTITY_ACCOUNT_DISABLED`.
- **`IdentityService.requireOperator(actor)`** returns `Operator(accountId, label, email)` for an operator whose account
  is not disabled, and refuses anyone else with `IDENTITY_OPERATOR_REQUIRED`. `isOperator(actor)` answers the same
  question as a boolean.
- **`IdentityService.person(actor)`** returns `Person(accountId, email, displayName)` of an active account, refusing a
  disabled one; `people(accountIds)` returns a map of the people behind those accounts, leaving unknown ones out and
  not filtering by status.
- **Labels.** `Person.label()` and `Operator.label` are the display name, or the address while there is none.

## Data

`V1__identity_create_accounts_codes_and_sessions.sql` creates every table the module owns:

- **`identity_account`.** `id`, `email` (stored as written), `display_name` (nullable), `status` (`active` or
  `disabled`, default `active`), `platform_role` (`user` or `operator`, default `user`), `last_login_at`, `version`,
  `created_at`, `updated_at`. The unique index `identity_account_email_key` on `lower(email)` makes an address one
  account whatever its letter case. Entity `Account`; enum values are stored in lower case by
  `LowercaseEnumConverters`.
- **`identity_external_identity`.** `id`, `account_id` (references `identity_account`, `on delete cascade`),
  `provider` (only `google`), `subject`, `created_at`; unique on `(provider, subject)`. The subject is stored exactly
  as Google issued it.
- **`identity_sign_in_challenge`.** One emailed code: `id` (the challenge, kept in the asking browser's session),
  `email`, `code_hash`, `failed_attempts`, `expires_at`, `created_at`; indexed on `lower(email)`.
- **`spring_session`, `spring_session_attributes`.** Spring Session JDBC's tables, created by Flyway
  (`spring.session.jdbc.initialize-schema: never`).

Other modules' tables reference `identity_account (id)` by foreign key. Persistence is split as the
[persistence guideline](../guidelines/persistence.md) describes: `AccountRepository`, `ExternalIdentityRepository` and
`SignInChallengeRepository` are Spring Data repositories, and `AccountQueryRepository` is the `JdbcClient` projection
of the operators' list.

## Accounts

- **Created by the first sign-in.** There is no registration or invitation. `IdentityService` finds the account by
  `lower(email)` and otherwise inserts it with `on conflict (lower(email)) do nothing`, so two first sign-ins of one
  address that race end on the same row.
- **One address, one account.** A typed code and a Google sign-in with the same address reach the same account.
- **Returning Google users** are found by Google's subject, so an address changed at Google keeps its account.
- **A first Google sign-in needs a verified address.** Without Google's `email_verified`, no account is created or
  joined (`IDENTITY_EMAIL_NOT_VERIFIED`). The subject is then linked to the account with
  `on conflict (provider, subject) do nothing`. A Google answer without an address fails with the OAuth error
  `email_missing`.
- **Name.** A provider's name fills `display_name` only while it is empty; a code sign-in brings no name.
- **Completing a sign-in.** A disabled account is refused (`IDENTITY_ACCOUNT_DISABLED`). An address listed in
  `beyondpilot.identity.operator-emails` that is not yet an operator becomes one, recorded as `operator.grant` with no
  actor and the detail `source: configuration`. `last_login_at` is set, and the log line
  `identity.sign_in.succeeded` carries `account_id` and `method` (`email_code` or `google`).

## Sign-in with an emailed code

Spring Security's one-time-token login, with BeyondPilot's own token service. A code works only together with the
challenge held in the session of the browser that asked for it, for a limited number of guesses, once, and until it
expires.

### Asking for a code

`POST /ott/generate` with the form field `username`, the address.

- **Only a plain address.** `SignInCodeRequestGuard` stands before Spring Security's filter, matched with Spring
  Security's own path matcher so that no spelling of the path passes around it. It answers `400` and stores nothing for
  a value longer than 320 characters or not matching `[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+`.
- **Limits first.** The guard asks `SignInCodeLimits`; a refused address gets `429` with `Retry-After` in seconds (at
  least 1), and nothing is stored or sent.
- **One step per address.** `SignInCodeService.generate` takes `pg_advisory_xact_lock(hashtext(lower(email)))`, checks
  the limits again under it, and only then stores the challenge, so requests for one address that arrive together
  cannot pass the limits.
- **The code.** Six digits from `SecureRandom`. The table stores only the SHA-256 of `challengeId:code`, compared in
  constant time. Codes expired for more than a day are deleted when a new code is stored.
- **Delivery.** `SignInCodeSender` publishes `SignInCodeRequested(email, code, validFor)`, which `notification` sends
  while the request waits. A failure of category `SERVICE_UNAVAILABLE` answers `503` with `Retry-After: 30`, and the
  code is deleted, so a code that never left neither works nor counts toward the limits below.
- **The answer.** `204` whether or not the address has an account, with the session cookie that now holds the
  challenge under `SignInCodeSender.CHALLENGE_ATTRIBUTE`. A new code replaces the previous one in the same browser.

### Limits per address

`SignInCodeLimits` counts the codes still stored for the address (by `lower(email)`), dated by when each was sent. A
code used to sign in is deleted, and its wrong guesses with it. Google sign-in is never limited. The checks run in
this order, and the first that applies refuses:

| Rule                                                                 | Property, default                      | Refused until                                                            |
| -------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------ |
| A pause after the newest code sent in the last hour                  | `sign-in-code-cooldown`, `60s`         | That code is 60 seconds old                                              |
| Codes sent in the last hour                                          | `sign-in-code-hourly-limit`, `10`      | The oldest of the counted ten is an hour old                             |
| Wrong guesses in the last 24 hours, over all codes sent in that time | `sign-in-code-daily-wrong-limit`, `30` | 24 hours after the first of those codes that took a wrong guess was sent |
| Wrong guesses in the last hour, over all codes sent in that time     | `sign-in-code-wrong-limit`, `15`       | One hour after the first of those codes that took a wrong guess was sent |

Each code takes `sign-in-code-attempts` guesses (default `5`) and works for `sign-in-code-lifetime` (default `15m`).
All properties are under `beyondpilot.identity`; the counts must be at least 1.

### Typing the code

`POST /login/ott` with the form field `code`, from the same browser.

- **The challenge comes from the session, never from the request.** `SignInCodeConverter` joins it to the typed code.
  A code typed in another browser is checked against that browser's own challenge, so it neither signs in nor spends a
  guess of the code it belongs to.
- **No challenge, an unknown one, or an expired one** answers `410`.
- **Each guess is paid before it is looked at.** One `update … where failed_attempts < :allowed returning` takes a
  guess in the database, so guesses sent together get no more turns than guesses sent in a row. With no guess left the
  answer is `429`.
- **A wrong code** answers `401`, and the guess that uses up the last turn answers `429`; after that the right code is
  refused too.
- **A right code** deletes the challenge; only the request whose delete removed the row signs in, and any other gets
  `410`, so a code works once.
- **Then the account.** `AccountUserDetailsService` signs in the address the challenge was sent to. A disabled account
  answers `403`. Success answers `204` with a new session identifier.

## Sign-in with Google

Spring Security's OAuth 2.0 login with the scopes `openid`, `email` and `profile`.

- **Only where configured.** The client registration exists only when `beyondpilot.identity.google.client-id` is set,
  and startup fails if `client-id` or `client-secret` is then blank. The `production` profile requires both
  (`application-production.yaml`); the environment variables are in the
  [development runtime runbook](../runbooks/development-runtime.md).
- **Start.** The browser opens `/oauth2/authorization/google?returnTo=…`. `config.ReturnToFilter` keeps `returnTo` in
  the session only when it is a path of this origin of at most 2000 characters, starting with one `/`, with no
  backslash, control character or whitespace.
- **Return.** `GoogleOidcUserService` signs the Google user in as described under [Accounts](#accounts). Success
  redirects to the remembered path, or to `/`. Failure redirects to `/sign-in?error=google` and logs
  `identity.sign_in.failed` with `method`, `error_type` and `error_code`; the code is logged only when it matches
  `[A-Za-z_]{1,64}` (a provider's lower-case codes and identity's own upper-case ones), otherwise as `other`.

## Session and roles

- **The session.** Spring Session JDBC. It ends 30 days after the last request (`spring.session.timeout: 30d`). The
  cookie `BEYONDPILOT_SESSION` is `HttpOnly`, `SameSite=Lax`, kept by the browser for 365 days, and `Secure` under the
  `production` profile.
- **The principal holds only the account.** `AccountUserDetails` (code) and `AccountOidcUser` (Google) carry the
  `Actor` and no authority. Role and status are read from the database by every operation that needs them, so a
  withdrawn role or a disabled account takes effect on the next call.
- **A disabled account.** It cannot sign in, and each call that reads the account through `IdentityService` or
  `AccountAdministration` refuses it. Its sessions are not deleted, and nothing it holds is removed.
- **Signing out.** `POST /logout` ends the session and answers `204`. A `GET` does not sign out.
- **Roles.** An account is a `user` or an `operator`; `operator` is GenAI Fund staff. Addresses in
  `beyondpilot.identity.operator-emails` (stripped, compared in lower case) become operators when they sign in, which
  is how the first operators exist.
- **Operator-only paths of other modules.** The bean `operatorsOnly` asks `AccountAdministration.isOperator`, read
  from the database on every request; the chain applies it to `/api/audit/**`, and denies those paths when no module
  supplies the bean ([ADR 0004](../decisions/0004-the-filter-chain-keeps-the-audit-log-for-operators.md)).

The request rules every path shares (the session requirement under `/api`, the `X-BeyondPilot-CSRF: 1` header on a
state-changing request, problems for refusals) are in [ARCHITECTURE.md](../../ARCHITECTURE.md#identity-and-authorization).

## Account administration

`AccountAdministration` is what operators do with accounts. Every operation first reads the caller's account and
requires an operator whose account is not disabled (`IDENTITY_OPERATOR_REQUIRED`).

- **Commands set a state.** Disabling a disabled account, enabling an active one, granting the role to an operator or
  withdrawing it from a user changes nothing and records nothing.
- **Locked while changed.** The target is read `PESSIMISTIC_WRITE`, so two operators changing one account act one after
  the other.
- **Not oneself.** An operator cannot disable their own account or withdraw their own role (`IDENTITY_OWN_ACCOUNT`).
- **Not a configured operator.** The role of an address in `beyondpilot.identity.operator-emails` cannot be withdrawn
  (`IDENTITY_OPERATOR_CONFIGURED`), since the next sign-in would give it back.
- **Recorded.** Each change is an audit event in the transaction of the change: `account.disable`, `account.enable`,
  `operator.grant` (detail `source: operator`) and `operator.withdraw`. The actor is the operator (id, label, address);
  the resource is `account` with the account's id and label.

### The list

`GET /api/identity/accounts` returns `AccountList`: `items`, `page`, `pageSize` (25) and `total`.

- **Parameters, all optional.** `q` (at most 100 characters) matches the address or the name containing it, ignoring
  case, with `%`, `_` and `\` taken literally; `status` is `active` or `disabled`; `role` is `user` or `operator`;
  `page` counts from 1. A value out of bounds is a `400` `REQUEST_INVALID` problem pointing at each parameter.
- **Order.** Latest sign-in first; accounts that never completed one come last, newest first, then by id.
- **Past the end.** A page past the last answers `200` with no items and the true `total`.
- **Each item** (`AccountSummary`): `id`, `email`, `displayName`, `role`, `status`, `lastSignInAt`, `createdAt`, and
  `configuredOperator`, true when the configuration names the address.

## HTTP

| Method and path                                                           | Answer                                                                                                                        |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `POST /ott/generate`                                                      | `204`; `400` not a plain address; `429` limited, `503` email not sent, both with `Retry-After`                                |
| `POST /login/ott`                                                         | `204` signed in; `401` wrong code; `410` no code waiting, expired or used; `429` too many wrong codes; `403` account disabled |
| `GET /oauth2/authorization/google`                                        | A redirect to Google, then to the remembered path or `/`, or to `/sign-in?error=google`                                       |
| `POST /logout`                                                            | `204`                                                                                                                         |
| `GET /api/identity/me` (`getMe`)                                          | `Me`: `id`, `email`, `displayName`, `role`; `401` no session; `403` `IDENTITY_ACCOUNT_DISABLED`                               |
| `GET /api/identity/accounts` (`listAccounts`)                             | `AccountList`; `400` invalid parameter                                                                                        |
| `POST /api/identity/accounts/{id}/disable` (`disableAccount`)             | `204`; `404`; `409` own account                                                                                               |
| `POST /api/identity/accounts/{id}/enable` (`enableAccount`)               | `204`; `404`                                                                                                                  |
| `POST /api/identity/accounts/{id}/grant-operator` (`grantOperator`)       | `204`; `404`                                                                                                                  |
| `POST /api/identity/accounts/{id}/withdraw-operator` (`withdrawOperator`) | `204`; `404`; `409` own account or configured operator                                                                        |

The four sign-in paths are Spring Security's and are not in `openapi.yml`; the `/api/identity` paths are, under the
security scheme `session`. Every account path also answers `401` without a session and `403` for a caller who is not an
operator. Every refusal is an RFC 9457 problem with the request identifier.

## Errors

`IdentityErrorCode`, turned into problems by `config.ApiExceptionHandler`:

| Code                           | Category, status     | When                                                    |
| ------------------------------ | -------------------- | ------------------------------------------------------- |
| `IDENTITY_ACCOUNT_DISABLED`    | Not permitted, `403` | The account is disabled, or a session's account is gone |
| `IDENTITY_EMAIL_NOT_VERIFIED`  | Not permitted, `403` | A first Google sign-in with an unverified address       |
| `IDENTITY_OPERATOR_REQUIRED`   | Not permitted, `403` | The caller is not an operator now                       |
| `IDENTITY_ACCOUNT_NOT_FOUND`   | Not found, `404`     | No account has that id                                  |
| `IDENTITY_OWN_ACCOUNT`         | Conflict, `409`      | An operator disables or demotes themselves              |
| `IDENTITY_OPERATOR_CONFIGURED` | Conflict, `409`      | Withdrawing the role of a configured operator           |

During sign-in these codes do not reach the browser as problems: on the code path `IDENTITY_ACCOUNT_DISABLED` becomes
the status `403`, and on the Google path any code becomes the redirect to `/sign-in?error=google`.

## Events

- **`SignInCodeRequested(email, code, validFor)`**, published by `SignInCodeSender`. It is the one event between
  modules that carries a secret, the code in clear: it is handled only by a synchronous listener, never by
  `@ApplicationModuleListener`, so it is never stored in the event publication registry, and its `toString` leaves out
  the address and the code ([ADR 0005](../decisions/0005-operators-run-email-delivery.md)).
- The module publishes no other event.

## Not done

- No password, no enterprise single sign-on, and no provider but Google.
- No editing of a name or an address, no deletion of an account, no invitation of someone who has not signed in.
- No limit by network address on asking for codes: the limits above are per address only.
- The backend reads no `locale` field on `POST /ott/generate`; the code email is the same whatever the screen sends.
