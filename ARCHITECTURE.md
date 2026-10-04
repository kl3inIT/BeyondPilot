# BeyondPilot architecture

This page states what is implemented today. Intended outcomes are in [docs/vision.md](docs/vision.md); planned work is in [docs/roadmap.md](docs/roadmap.md) and never appears here as a fact. Update this page in the change that makes a statement true or false.

## Runtime overview

```mermaid
flowchart LR
  browser[Browser] --> web["web: Next.js 16 (port 3000)"]
  web -. "Spring paths, rewritten in development" .-> backend["backend: Spring Boot 4.1 (port 8080)"]
  backend --> db[(PostgreSQL 18)]
  backend -- "OpenApiContractTest" --> contract[openapi.yml]
  contract -- "pnpm generate:api" --> web
```

- **backend** is one Spring Boot application on Java 25 with virtual threads ([ADR 0001](docs/decisions/0001-single-spring-boot-application-with-modulith-modules.md)). Over HTTP it answers `/actuator/health`, the sign-in endpoints and `GET /api/identity/me`, and every failure as an RFC 9457 problem.
- **web** is one Next.js App Router application ([ADR 0002](docs/decisions/0002-nextjs-frontend-over-the-spring-backend.md)). It serves the public home page in English at `/` and in Vietnamese at `/vi`, and a shared coming-soon page for the planned destinations listed in `web/src/lib/site.ts`. It makes no backend call yet.
- **One origin.** Spring owns `/api`, `/login`, `/logout`, `/oauth2` and `/ott`. During development Next.js rewrites those paths to `BEYONDPILOT_API_ORIGIN`; `web/src/proxy.ts` excludes them from locale routing. No reverse proxy is configured, because nothing is deployed.
- **The API contract** is `openapi.yml` at the repository root, generated from the full backend context by `OpenApiContractTest` and turned into TypeScript types in `web/src/lib/api/generated`. It currently declares one path, `GET /api/identity/me`, and the shared `Problem` schema. Both sides fail their gate when their copy is stale.

## Code and capability boundaries

### Backend

Every direct subpackage of `ai.genaifund.beyondpilot` is a closed Spring Modulith module; `ModulithArchitectureTest` verifies the structure and pins the module list. The placement rules are in the [backend guide](docs/guidelines/backend.md#where-things-live).

| Package | Holds today |
| --- | --- |
| `ai.genaifund.beyondpilot` | `BeyondPilotApplication` and the failure types every module shares: `BusinessException`, `ErrorCode`, `ErrorCategory` |
| `ai.genaifund.beyondpilot.config` | The security filter chain, the error path and the OpenAPI configuration; depends on no module |
| `ai.genaifund.beyondpilot.identity` | Accounts, sign-in with Google and with an emailed link, the operator role; `Actor` and `@CurrentActor` for other modules. Depends on `notification` |
| `ai.genaifund.beyondpilot.notification` | `EmailService`: the emails the application sends, over SMTP |

No other business module exists. The error path in `config` is the application's only exception handling ([API errors](docs/conventions.md#api-errors)):

- `RequestIdFilter` gives each request an identifier, returned in `X-Request-Id` and logged as `request_id`.
- `ApiExceptionHandler` turns module failures and request validation into problems with a stable `code`, and keeps Spring MVC's own problems.
- `ProblemErrorController` renders anything that escapes the handler, including uncaught exceptions, as a problem without internal detail.
- `RequestIdProblemAdvice` adds `requestId` to every problem body.

### Web

The folder rules are in [conventions › Frontend › Structure](docs/conventions.md#structure) and the [web guide](web/AGENTS.md).

| Path under `web/src` | Holds today |
| --- | --- |
| `app/[locale]/(public)/` | The home page, composed from sections, and the coming-soon catch-all |
| `components/sections/` | The home page sections: hero with search, programs and events timeline, directory tabs, partner logos, founders, FAQ |
| `components/layout/` | Site header and footer, mobile menu, brand lockup, light and dark theme switch |
| `components/actions/` | The product's action components (`Button`, `IconButton`, `TextButton`, `ActionLink`) over shared action styles |
| `components/ui/` | shadcn registry primitives |
| `lib/api/generated/` | Types generated from `openapi.yml` |
| `i18n/`, `proxy.ts`, `../messages/` | Locale routing (`en` without a prefix, `vi` under `/vi`) and the two message catalogs |
| `styles/tokens.css` | Semantic design tokens, light and dark |

There is no `features/` folder yet: no application screen exists. The home page links its campaign call to action to the interim campaign page that GenAI Fund runs outside this repository.

## Identity and authorization

Sign-in is Spring Security inside the backend; there is no separate identity server ([identity increment](docs/increments/active/bey-30-identity/design.md)).

- **Two ways in, one account per address.** A link emailed to an address (single use, 15 minutes) and Google sign-in. A redeemed link and a Google sign-in with the same verified address reach the same account. Google sign-in exists only where an OAuth client is configured.
- **Session.** Spring Session stores it in PostgreSQL; it ends 30 days after the last request. The cookie `BEYONDPILOT_SESSION` is `HttpOnly` and `SameSite=Lax`, and `Secure` under the `production` profile. The session holds only the account identifier; role and status are read from the database.
- **Requests.** A path under `/api` needs a session unless `SecurityConfiguration` opens it. A request that changes state must carry `X-BeyondPilot-CSRF: 1`. Refusals are 401 and 403 problems.
- **Roles.** An account is a `user` or an `operator`. The addresses in `BEYONDPILOT_IDENTITY_OPERATOR_EMAILS` become operators when they sign in. No screen grants the role yet, and no endpoint requires it yet.
- The web application has no sign-in screen yet; the endpoints are exercised by the tests and by hand.

## Data ownership and consistency

- PostgreSQL 18.6 is the only data store, pinned to the same image for local Docker Compose and for Testcontainers.
- Flyway owns the schema and Hibernate only validates it (`ddl-auto: validate`); `open-in-view` is off. One migration exists: `identity` owns the account and external-identity tables and the tables of Spring Security's one-time tokens and Spring Session.
- The rules for the first schema are in the [persistence guideline](docs/guidelines/persistence.md).

## Deployment and operations

- No environment is deployed and no container image is built.
- Email goes over SMTP. Local runs deliver to a Mailpit container, so nothing leaves the machine; no mail provider is chosen for deployed environments yet.
- Local runs use no Spring profile. The `production` profile reads the database from `BEYONDPILOT_DATABASE_*` without defaults and logs Logstash-format JSON; `staging` adds DEBUG logging for the application's own code ([runbook](docs/runbooks/development-runtime.md#profiles-and-environment-variables)).
- Continuous integration runs on every branch push: workflow lint and a secret scan, the backend gate, the web gate with a dependency audit, and Playwright with axe on the production build ([testing guideline](docs/guidelines/testing.md#continuous-integration)). Dependabot proposes Gradle, pnpm and GitHub Actions upgrades weekly.
- Metrics, tracing and dashboards do not exist; logs are the only operational signal.
