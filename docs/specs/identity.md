# Identity

Who is signed in: accounts, sign-in with Google and with an emailed six-digit code, the session, and the operator
role that GenAI Fund staff hold. Sign-in is Spring Security inside the backend, with no separate identity server. It was
delivered by [BEY-30](../increments/completed/bey-30-identity/design.md), and the operators' account administration by
[BEY-48](../increments/completed/bey-48-admin-accounts/design.md). The code is the `identity` application module,
`backend/src/main/java/ai/genaifund/beyondpilot/identity`; the filter chain that wires its sign-in pieces is
`config.SecurityConfiguration`. The checks that hold this contract are in the [identity matrix](../tests/identity.md).

## Module

- **Published API.** The package root: `IdentityService`, `AccountAdministration`, `AppConnections`,
  `AppHostAdministration`, `AuditLogDownload`, `Actor`, `@CurrentActor`, `Operator`, `Person`, `McpAudience`,
  `McpCaller`, `McpCallers`, `McpCallRefused`, `SignInCodeRequested`, `IdentityProperties`, `IdentityErrorCode` and
  `IdentityException`.
- **Internal packages.** `signin` holds the Spring Security adapters (the code service, its request guard and limits,
  the code converter and sender, the Google user service, the principals and `SignInConfiguration`); `oauth` the
  authorization server AI apps sign in through ([Connecting AI apps](#connecting-ai-apps)); `web` the controllers; `dto`
  the request and response records; `persistence` the entities and repositories.
- **Dependencies.** `@ApplicationModule(type = CLOSED, allowedDependencies = { "audit", "shared" })`. `identity`
  records its changes through `audit` ([ADR 0003](../decisions/0003-an-audit-module-that-modules-record-through.md)).
  It does not depend on `notification`: a sign-in code leaves as the event `SignInCodeRequested`
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
- **`IdentityService.person(actor)`** returns `Person(accountId, email, displayName, country, phone)` of an active
  account, refusing a disabled one; `people(accountIds)` returns a map of the people behind those accounts, leaving
  unknown ones out and not filtering by status.
- **`IdentityService.reachAtIfUnknown(actor, country, phone)`** keeps a country and a phone number the person gave
  elsewhere where the account has none; what the account holds is left as it is. `proposal` calls it on a submission.
- **Consent (BEY-240).** `IdentityService.requirePartnersConsent(actor)` refuses with
  `IDENTITY_PARTNERS_CONSENT_REQUIRED` a person whose latest `partners` choice is not an agreement; `proposal` calls it
  before submitting an application and sending a use case proposal. `IdentityService.declined(accountId, purpose)` says
  whether the person's latest choice for a `ConsentPurpose` is a refusal; an account that has not answered has not
  declined. `talent` and `proposal` read it for `AI`.
- **Labels.** `Person.label()` and `Operator.label` are the display name, or the address while there is none.
- **The MCP servers' callers.** `McpCallers.authenticate(token, audience)` returns the
  `McpCaller(accountId, clientId, connectionId)` behind a call to the server `McpAudience` names, or throws
  `McpCallRefused`; `site()` and `address(audience)` give the public addresses. `AppConnections.appNames(clientIds)`
  names apps as people see them. `mcp` calls these.

## Data

`V1__identity_create_accounts_codes_and_sessions.sql` creates every table the module owns:

- **`identity_account`.** `id`, `email` (stored as written), `display_name` (nullable), `status` (`active` or
  `disabled`, default `active`), `platform_role` (`user` or `operator`, default `user`), `last_login_at`, `version`,
  `created_at`, `updated_at`. The unique index `identity_account_email_key` on `lower(email)` makes an address one
  account whatever its letter case. `V56__identity_add_account_contact.sql` adds `country` (ISO 3166-1 alpha-2) and
  `phone` (up to 40 characters), both nullable. Entity `Account`; enum values are stored in lower case by
  `LowercaseEnumConverters`.
- **`identity_external_identity`.** `id`, `account_id` (references `identity_account`, `on delete cascade`),
  `provider` (only `google`), `subject`, `created_at`; unique on `(provider, subject)`. The subject is stored exactly
  as Google issued it.
- **`identity_sign_in_challenge`.** One emailed code: `id` (the challenge, kept in the asking browser's session),
  `email`, `code_hash`, `failed_attempts`, `expires_at`, `created_at`; indexed on `lower(email)`.
- **`spring_session`, `spring_session_attributes`.** Spring Session JDBC's tables, created by Flyway
  (`spring.session.jdbc.initialize-schema: never`).
- **`oauth2_registered_client`, `oauth2_authorization`.** Spring Authorization Server's JDBC tables, created by
  `V51__identity_create_oauth_authorization.sql`: the AI apps that have signed in, and each connection with its code
  and tokens.
- **`identity_app_host`, `identity_app_setting`.** The reviewed app hosts and the single row saying whether apps of
  other hosts may connect (default yes), created and seeded by `V54__identity_create_app_hosts.sql`.

Other modules' tables reference `identity_account (id)` by foreign key. Persistence is split as the
[persistence guideline](../guidelines/persistence.md) describes: `AccountRepository`, `ExternalIdentityRepository` and
`SignInChallengeRepository` are Spring Data repositories, and `AccountQueryRepository` is the `JdbcClient` projection
of the operators' list.

- **`identity_consent_record`** (`V112__identity_create_consent_records.sql`). `id`, `account_id`, `purpose`, `granted`,
  `version`, `locale`, `source`, `request_id`, `recorded_at`; indexed by account, purpose and time; a trigger refuses
  every update and delete.

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
- **Name.** A provider's name fills `display_name` only while it is empty; a code sign-in brings no name. The person
  changes it on the Account page with the contact below (at most 120 characters; left out or blank keeps it).
- **Country and phone.** Both are optional and never asked at sign-in. The person sets or clears them on the Account
  page (`/account`, `PUT /api/identity/me/contact`); a first submitted application fills the ones still empty. The
  apply form starts from them where neither the application nor the latest other one holds a value.
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
- **Order.** Latest sign-in first; accounts that never completed one come last, newest first, then by id. `sort`
  names another: `name` (the display name, else the address, ignoring case), `lastSignIn` (never signed in last either
  way) or `created`, ascending, or descending with `-` before the key, then by id. Another value is a `400`.
- **Past the end.** A page past the last answers `200` with no items and the true `total`.
- **Each item** (`AccountSummary`): `id`, `email`, `displayName`, `role`, `status`, `lastSignInAt`, `createdAt`, and
  `configuredOperator`, true when the configuration names the address.

## Connecting AI apps

AI apps reach BeyondPilot's two MCP servers, `/mcp` for every signed-in person and `/mcp/operator` for operators,
through Spring Authorization Server inside this application ([BEY-78](../increments/completed/bey-78-mcp/design.md)).
Its filter chain (`oauth.AuthorizationServerConfiguration`) comes before the application's, covers its own endpoints
only and shares the session, so a person signed in on the site is signed in there. Settings are under
`beyondpilot.identity.oauth` (`OAuthSettings`): `issuer` (the site's address), `signing-key` (the RSA key that signs
tokens; without it a key is made at each start, so tokens do not survive a restart), and the lifetimes and fetch limits
below.

- **Which apps.** An app is identified by a client ID metadata document: its client ID is the HTTPS address of a JSON
  document naming it and its redirect addresses. `ClientMetadataDocuments` reads it through `OutsideHttp` (public
  addresses only, as resolved, no redirect, five seconds, five kilobytes), stores it, and reads it again once the time
  its Cache-Control asks for has passed, kept between five minutes and a day. An address that could not be read is not
  fetched again for five minutes, and fetches are limited per minute for each requester (10), each document host (30)
  and all together (120). Two clients are BeyondPilot's own: `cursor`, and `mcp-local` for an agent on the person's
  computer. There is no dynamic registration.
- **Reviewed hosts.** Operators keep the hosts whose apps BeyondPilot has reviewed (`AppHostAdministration`, Admin › AI
  › MCP), and whether apps of any other host may connect, labelled Not reviewed. Each change is audited as
  `mcp.host_add`, `mcp.host_remove`, `mcp.other_hosts_allow` or `mcp.other_hosts_refuse`; a repeat records nothing.
- **Consent.** A person not signed in is sent to `/sign-in` and back. Every connection shows the consent page
  (`/oauth-consent`), even for an app allowed before; the page reads only the caller's own waiting request
  (`GET /api/identity/apps/connecting`). A redirect must match the document exactly, except that `localhost`,
  `127.0.0.1` and `::1` match on any port. A request names one server as its resource and asks for its scope
  (`mcp.read` or `mcp.research`, with `offline_access` for a refresh token); the operators' scope is taken out of the
  consent of anyone who is not an operator. The code is returned with `iss` and needs its PKCE verifier (S256).
- **Tokens.** A signed JWT for exactly one server, valid for `access-token-lifetime` (`1h`). A refresh token is good for
  one use and replaced at each (`refresh-token-lifetime`, `30d`), also for apps that hold no secret. Every issue,
  refresh included, needs an active account and, for the operators' scope, an operator now. A connection ends
  `connection-lifetime` (`180d`) after the consent however often it is refreshed; `ExpiredConnections` deletes dead
  connections once a day.
- **At each call.** `McpCallers.authenticate` checks that the token is for that server with its scope, that its
  connection still stands, that the account is active and, for `/mcp/operator`, an operator; otherwise
  `McpCallRefused` answers `401` `invalid_token` or `403` `insufficient_scope`.
- **Connected apps.** A person lists the apps they connected, with the servers each may call, and revokes one
  (`/account/mcp`); operators list every person's connections and revoke one (Admin › AI › MCP). A revoke stops the
  refresh token at once and the access token at its next call, and is audited as `mcp.app_revoke`.

## Consent to the use of personal data

What each person agreed to about their personal data, as Vietnam's Personal Data Protection Law (Law 91/2025/QH15) and
Decree 356/2025/ND-CP require (BEY-240; [design](../increments/active/bey-240-personal-data-consent/design.md),
[research](../research/2026-10-22-personal-data-consent.md)).

- **Purposes.** `ConsentPurpose`: `platform` (required to use the platform), `partners` (needed to submit an
  application or send a use case proposal), `ai` and `updates` (optional). Each was last asked by version 1.
- **Text.** Each version is an unchanged file, `backend/src/main/resources/consent/v<version>.<locale>.md`; version 1
  is English, GenAI Fund's text of 22 October 2026 with the AI purpose. `Consents.VERSION` names the current one. A new
  text is a new file and a new version; a purpose it asks again gets a higher `askedSince`, and a choice made under
  an older version no longer counts.
- **Record.** `PUT /api/identity/consent` writes a row of `identity_consent_record` for each purpose whose choice
  changes or that the person never answered, so the first answer records all four, a refusal included. Rows are never
  changed or deleted. A person's current choice for a purpose is their latest row for it.
- **Needed.** An account whose latest `platform` choice is missing or a refusal has `consentNeeded` on `/me`. The web
  sends it to `/consent` from every page. Its MCP tokens still work, but every tool call answers an error result that
  names `/consent` (`McpCallers.consentNeeded`), logged as `refused`. The API itself does not refuse it.
- **Withdrawal.** Each recorded choice publishes `ConsentChanged`. A withdrawal of `platform` emails the person a
  confirmation (`consent_withdrawn`); no other choice is emailed, and nobody at GenAI Fund is.

## HTTP

| Method and path                                                              | Answer                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /ott/generate`                                                         | `204`; `400` not a plain address; `429` limited, `503` email not sent, both with `Retry-After`                                                                                                                                                                                   |
| `POST /login/ott`                                                            | `204` signed in; `401` wrong code; `410` no code waiting, expired or used; `429` too many wrong codes; `403` account disabled                                                                                                                                                    |
| `GET /oauth2/authorization/google`                                           | A redirect to Google, then to the remembered path or `/`, or to `/sign-in?error=google`                                                                                                                                                                                          |
| `POST /logout`                                                               | `204`                                                                                                                                                                                                                                                                            |
| `GET /api/identity/me` (`getMe`)                                             | `Me`: `id`, `email`, `displayName`, `role`, `country`, `phone`, `consentNeeded`; `401` no session; `403` `IDENTITY_ACCOUNT_DISABLED`                                                                                                                                             |
| `GET /api/identity/consent` (`getMyConsent`)                                 | `Consent`: `version`, `locale`, `text` (Markdown), `needed`, and each purpose with `requiredFor`, the caller's `granted` and `answeredAt`; `401`; `403`                                                                                                                          |
| `PUT /api/identity/consent` (`recordMyConsent`)                              | `Consent` after recording `platform`, `partners`, `ai`, `updates` and `source` (`accept_all`, `choose`, `settings`, `undo` or `application`); `400` a purpose or the source missing or unknown; `401`; `403`                                                                     |
| `PUT /api/identity/me/contact` (`updateMyContact`)                           | `Me` after replacing `country` and `phone` (a part left out is cleared) and `name`; `400` not written as asked; `401`; `403`                                                                                                                                                     |
| `GET /api/identity/accounts` (`listAccounts`)                                | `AccountList`; `400` invalid parameter                                                                                                                                                                                                                                           |
| `POST /api/identity/accounts/{id}/disable` (`disableAccount`)                | `204`; `404`; `409` own account                                                                                                                                                                                                                                                  |
| `POST /api/identity/accounts/{id}/enable` (`enableAccount`)                  | `204`; `404`                                                                                                                                                                                                                                                                     |
| `POST /api/identity/accounts/{id}/grant-operator` (`grantOperator`)          | `204`; `404`                                                                                                                                                                                                                                                                     |
| `POST /api/identity/admin/audit-events/export` (`exportAuditEvents`)         | The audit log as an Excel workbook or CSV, narrowed by `from`, `action` and `q`, every page of it; recorded as `audit.export`. Here and not in `audit`, which cannot name the caller (ADR 0004); `AuditLogDownload` checks the operator and reads through `AuditLog.spreadsheet` |
| `POST /api/identity/accounts/{id}/withdraw-operator` (`withdrawOperator`)    | `204`; `404`; `409` own account or configured operator                                                                                                                                                                                                                           |
| `GET /api/identity/apps/connecting` (`getConnectingApp`)                     | The app waiting for the caller's consent; `404` `IDENTITY_APP_REQUEST_NOT_FOUND`                                                                                                                                                                                                 |
| `GET /api/identity/apps` (`listConnectedApps`)                               | The caller's connected apps, the latest used first                                                                                                                                                                                                                               |
| `POST /api/identity/apps/{id}/revoke` (`revokeConnectedApp`)                 | `204`; `404` `IDENTITY_APP_NOT_CONNECTED`                                                                                                                                                                                                                                        |
| `GET /api/identity/admin/apps` (`listEveryConnectedApp`)                     | Every person's connected apps                                                                                                                                                                                                                                                    |
| `POST /api/identity/admin/apps/{accountId}/{id}/revoke` (`revokePersonsApp`) | `204`; `404` `IDENTITY_APP_NOT_CONNECTED`                                                                                                                                                                                                                                        |
| `GET /api/identity/admin/app-hosts` (`getAppHosts`)                          | The reviewed hosts, each with the apps known to publish on it, and whether other hosts may connect                                                                                                                                                                               |
| `POST /api/identity/admin/app-hosts/add` (`addAppHost`)                      | `204`; `400` `IDENTITY_APP_HOST_INVALID`                                                                                                                                                                                                                                         |
| `POST /api/identity/admin/app-hosts/remove` (`removeAppHost`)                | `204`; `404` `IDENTITY_APP_HOST_NOT_FOUND`                                                                                                                                                                                                                                       |
| `PUT /api/identity/admin/app-hosts/other-hosts` (`allowOtherAppHosts`)       | `204`                                                                                                                                                                                                                                                                            |

The four sign-in paths and the authorization server's endpoints are Spring Security's and are not in `openapi.yml`; the
`/api/identity` paths are, under the security scheme `session`. Every account path and every `/api/identity/admin` path
also answers `401` without a session and `403` for a caller who is not an operator. Every refusal is an RFC 9457
problem with the request identifier.

## Errors

`IdentityErrorCode`, turned into problems by `config.ApiExceptionHandler`:

| Code                                 | Category, status     | When                                                    |
| ------------------------------------ | -------------------- | ------------------------------------------------------- |
| `IDENTITY_ACCOUNT_DISABLED`          | Not permitted, `403` | The account is disabled, or a session's account is gone |
| `IDENTITY_EMAIL_NOT_VERIFIED`        | Not permitted, `403` | A first Google sign-in with an unverified address       |
| `IDENTITY_OPERATOR_REQUIRED`         | Not permitted, `403` | The caller is not an operator now                       |
| `IDENTITY_PARTNERS_CONSENT_REQUIRED` | Not permitted, `403` | Submitting or sending without the `partners` consent    |
| `IDENTITY_ACCOUNT_NOT_FOUND`         | Not found, `404`     | No account has that id                                  |
| `IDENTITY_APP_HOST_INVALID`          | Validation, `400`    | An app host that is not a host name                     |
| `IDENTITY_APP_HOST_NOT_FOUND`        | Not found, `404`     | Removing a host that is not in the reviewed list        |
| `IDENTITY_APP_NOT_CONNECTED`         | Not found, `404`     | Revoking an app the person has not connected            |
| `IDENTITY_APP_REQUEST_NOT_FOUND`     | Not found, `404`     | No connection request of the caller's is waiting        |
| `IDENTITY_OWN_ACCOUNT`               | Conflict, `409`      | An operator disables or demotes themselves              |
| `IDENTITY_OPERATOR_CONFIGURED`       | Conflict, `409`      | Withdrawing the role of a configured operator           |

During sign-in these codes do not reach the browser as problems: on the code path `IDENTITY_ACCOUNT_DISABLED` becomes
the status `403`, and on the Google path any code becomes the redirect to `/sign-in?error=google`.

## Events

- **`SignInCodeRequested(email, code, validFor)`**, published by `SignInCodeSender`. It is the one event between
  modules that carries a secret, the code in clear: it is handled only by a synchronous listener, never by
  `@ApplicationModuleListener`, so it is never stored in the event publication registry, and its `toString` leaves out
  the address and the code ([ADR 0005](../decisions/0005-operators-run-email-delivery.md)).
- **`ConsentChanged(accountId, purpose, granted, withdrawal)`**, published by `Consents` for each choice it records,
  in that transaction. `notification` emails a withdrawal of `platform`; `talent` has the person's profile indexed
  again when `ai` changes.
- The module publishes no other event.

## Not done

- No password, no enterprise single sign-on, and no provider but Google.
- No editing of an address, no deletion of an account, no invitation of someone who has not signed in.
- No limit by network address on asking for codes: the limits above are per address only.
- The backend reads no `locale` field on `POST /ott/generate`; the code email is the same whatever the screen sends.
