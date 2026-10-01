# Engineering conventions

These conventions apply across BeyondPilot. Module-specific behavior belongs in `docs/specs/`; change-local reasoning belongs in the active increment ([operating model](guidelines/operating-model.md)). The backend checklist that points into this page is the [backend guide](guidelines/backend.md).

## Change design

- Prefer the smallest complete production path over scaffolding for a hypothetical future path.
- Do not add interfaces, adapters, configuration modes or deployment units without a current caller and an owned lifecycle. The one deliberate exception is the [interchangeable-implementations pattern](#interchangeable-implementations-strategy-behind-a-registry).
- Use a clean cutover: migrate every caller and remove obsolete code, configuration, comments and tests in the same change.
- Never ship a temporary runtime mode, one-shot profile, convenience endpoint or unused abstraction to make an incomplete flow operable. Disposable verification helpers stay in tests or scratch files and are never packaged into the application.
- Keep the module boundaries recorded in [ARCHITECTURE.md](../ARCHITECTURE.md). A new dependency edge between modules requires an architecture decision and an update to `ModulithArchitectureTest`.

## Design patterns

### Interchangeable implementations: Strategy behind a registry

Use this pattern when a module performs one function through one of several interchangeable implementations, and configuration or persisted data chooses which one runs. Typical cases are external vendors and protocols: email delivery, AI model providers, identity providers, storage backends. Each implementation is a Strategy for the function and an Adapter over one vendor's API; a registry selects it by key.

- **One interface per function**, named `<Function>Adapter`, not one interface per vendor. A function that only some implementations offer gets its own interface and registry instead of methods that throw "unsupported".
- **One class per implementation**, named `<Vendor><Function>Adapter`, registered as a Spring bean in the owning module's `adapter` subpackage.
- **One registry**, named `<Family>AdapterRegistry`, receives every adapter bean through its constructor and resolves an adapter by key:
  - **Closed family** (the product supports a fixed list): key by the persisted enum `<Family>Provider` in an `EnumMap`. Startup fails when a constant has no adapter or two.
  - **Open family** (a new implementation is only a new bean): key by the adapter's stable string type. Startup fails on a duplicate key.
- **The key is identity only.** What an implementation supports (features, limits, defaults) comes from the adapter as a `<Family>ProviderCapabilities` record, not from flags on the enum.
- **Shared mechanics stay shared.** HTTP client setup, retries, metrics and result validation live in one place that delegates to the adapter; they are not copied into each adapter.
- **Naming.** Vendor names are `UpperCamelCase` with acronyms written as words (`OpenAi`, `Ses`), spelled the same everywhere. Class names carry no authentication mode or API version. Request and result records are `<Function>Request` and `<Function>Result`.
- **Apply it from the first implementation.** This pattern is the deliberate exception to the rule against single-implementation interfaces. Do not use it for code that has exactly one implementation by nature, such as a repository or an application service.

Example of a closed family:

```java
public interface EmailAdapter {
    EmailProvider provider();

    EmailResult send(EmailRequest request);
}

@Component
class EmailAdapterRegistry {

    private final Map<EmailProvider, EmailAdapter> adapters;

    EmailAdapterRegistry(List<EmailAdapter> beans) {
        var byProvider = new EnumMap<EmailProvider, EmailAdapter>(EmailProvider.class);
        for (EmailAdapter adapter : beans) {
            if (byProvider.put(adapter.provider(), adapter) != null) {
                throw new IllegalStateException("Two email adapters for " + adapter.provider());
            }
        }
        for (EmailProvider provider : EmailProvider.values()) {
            if (!byProvider.containsKey(provider)) {
                throw new IllegalStateException("No email adapter for " + provider);
            }
        }
        this.adapters = byProvider;
    }

    EmailAdapter forProvider(EmailProvider provider) {
        return Objects.requireNonNull(adapters.get(provider));
    }
}
```

## Reference-based design and scope control

Production readiness is a required quality standard for the agreed scope from the start: correct behavior, authorization, data integrity, bounded resource use, failure handling, observability, and appropriate verification and deployment practices. Scope control must not be used to defer necessary engineering or to deliver a prototype in place of the requested system.

Scope creep means adding unrequested behavior or mechanisms without establishing why the agreed scope needs them. Necessary hardening is part of the scope even when nobody enumerated every failure case. Establish the need through concrete requirements, source analysis, credible failure scenarios or measurements; do not wait for a production incident. Choose the simplest sufficient mechanism and explain its tradeoffs.

- When a reference implementation is the baseline (an existing GenAI Fund system, MemoryOS, a framework sample), inspect it and cite the revision and code path. Separate observed behavior, inferred rationale, proposed changes, accepted decisions and verified implementation. State evidence gaps instead of assuming the reference lacks a capability.
- Before recommending a material departure from the reference, record in the active design: the current requirement or demonstrated failure; the reference behavior and its strengths; the proposed difference; its concrete benefit; its implementation, operational and UX costs; the simpler baseline option; and the evidence needed to choose. If the benefit does not justify the cost, keep the baseline.
- Use native framework abstractions. Evaluate public high-level APIs and shipped implementations before a low-level SPI or an application-built equivalent. Prefer native configuration and hooks, then composition or implementation of a public interface; extend a base class only when it is designed for extension. Avoid internal classes, reflection and copied engines.
- Evaluate framework reuse across the whole accepted scope, not only the next step. A missing connection calls for integration, not a duplicate engine.
- Do not prebuild workers, queues, event journals, configuration snapshots, registries or plugin mechanisms for hypothetical future use. Extensibility starts with usable framework APIs and actual consumers, not empty packages.
- Carry accepted decisions across turns. Do not reopen rejected additions or silently promote suggestions into scope.
- Keep validation claims proportional to evidence. Source review, diagrams, isolated probes and production acceptance are different results.
- When a decision changes, reconcile the design, plan, references and diagrams together, and keep one canonical statement of each decision.

## Boundary discovery

Module boundaries are discovered from domain evidence, not inferred from folders, tables, entities, frameworks or imagined future services. Every new module, and every material change to a boundary, follows this sequence:

```text
Domain Story
→ Visual Glossary
→ Events, Commands, Aggregates and Read Models
→ Data and Invariant Owner
→ Context Map and Communication Pattern
→ Package-Level Application Module
→ Boundary Verification
→ Gradle or Deployment Split Only with Evidence
```

1. **Domain Story:** record actors, work objects, ordered actions, the outcome, and important failure and recovery paths in the active increment.
2. **Visual Glossary:** define one term per concept, its relationships and cardinality, and where the same real-world object means different things. Do not proceed while terms such as Organization, Member, Applicant, Provider, Solution, Use Case, Campaign or Proposal are overloaded.
3. **Events, Commands, Aggregates and Read Models:** identify intent, observed business facts, consistency boundaries and projections. Distinguish synchronous invariants from asynchronous reactions.
4. **Data and Invariant Owner:** assign one module as the source of truth for each table, lifecycle and invariant. No two modules write the same table or import each other's persistence package.
5. **Context Map:** state provided and required APIs, dependency direction, synchronous calls, events, failure and consistency semantics, actors and non-functional requirements. Reject unexplained cycles.
6. **Package Module First:** implement the smallest complete vertical slice as a closed Spring Modulith package module with a narrow public root and internal `web`, `persistence`, `adapter` or feature subpackages. A bounded context may contain several modules; a module is not automatically a service or a Gradle project.
7. **Verify:** enforce module completeness, allowed dependencies, internal and persistence ownership, and observable contracts in CI.
8. **Physical Split with Evidence:** add a Gradle project or deployable only for a concrete classpath or dependency conflict, an independently selected runtime, release or team ownership, a scaling or failure boundary, or a demonstrated build bottleneck. Record the accepted tradeoff in an ADR after implementation starts.

Keep parts together when they share one language, invariant owner, transaction and lifecycle, and reason to change. Separate them when language, source of truth, invariants, actors, lifecycle, failures, non-functional requirements or change ownership diverge and an explicit one-way contract exists. When evidence is incomplete, prefer fewer modules and preserve later extraction through published APIs rather than predeclaring placeholders.

## Java and Gradle

- Target JDK 25. Use the Gradle wrapper at the repository root (`./gradlew :backend:<task>`); never a system Gradle.
- Centralize dependency versions in `gradle/libs.versions.toml`.
- Use explicit imports and short type names in handwritten Java, including tests. Keep a fully qualified name only to resolve a name collision; remove unused imports.
- Use `lowerCamelCase` for methods and `UpperCamelCase` for classes. Keep external protocol identifiers (JSON fields, tool names, provider parameters) separate from Java names, and preserve them when refactoring.
- Prefer immutable value types and constructor validation at public boundaries.
- Construct records by shape. Required components only: the canonical constructor. Components present or absent together because the value is one of several kinds: a sealed interface with one record per kind. Many independent optional components: a nested `static Builder` whose `build()` calls the canonical constructor. A few meaningful variants: named static factories. Never add a telescoping constructor or pass three or more positional nulls; migrate callers instead of adding an overload. Lombok is not used.
- An expected failure travels as a typed exception and is matched by type ([API errors](#api-errors)).
- Every main Java package declares JSpecify `@NullMarked` in its `package-info.java`, so types are non-null by default; mark each optional value with `org.jspecify.annotations.Nullable`. A Spring Data lookup that can miss returns `Optional`.
- Preserve exact security identifiers. Do not normalize issuer, subject, actor ID, email or username unless a module contract explicitly requires it.
- Persistence follows the [persistence guideline](guidelines/persistence.md).

## Testing

Every test must identify the observable contract and the regression it would catch. Use the smallest boundary that can actually detect that regression:

| Contract | Default test boundary |
| --- | --- |
| Business rule, validation, ordering, state transition | Plain unit test with real value objects; substitute only external collaborators |
| HTTP mapping, binding, validation, JSON or filter behavior | MVC slice with the relevant security configuration; calling a controller method directly is insufficient |
| SQL, migration, locking, transaction or constraint | Repository or application integration test against PostgreSQL and the Flyway migrations |
| Module boundary and inter-module events | `@ApplicationModuleTest` for the module; `ModulithArchitectureTest` for the whole structure |
| Application composition, sessions, actor binding or background lifecycle | Full application context; real HTTP when the transport is part of the contract |
| Browser interaction and recovery | Component test for local behavior; browser test for routing, cookies, network and browser-owned behavior |
| Deployed feature acceptance | Authenticated runtime smoke test against the deployed release and its real dependencies |

- Do not test generated accessors, framework defaults, private methods, fixed call sequences or source spelling. Architecture and generated-contract drift checks are exceptions because those boundaries are repository contracts.
- Before adding a test, check the module's verification matrix in `docs/tests/` and existing cases. Extend an existing case when it covers the same behavior, boundary and failure mode.
- Test through the public entry point. Do not export a helper, add a constructor or overload, or keep dead code alive only so a test can reach it.
- Remove a test only with an explicit explanation of its missing value or a named replacement that preserves its assertions. Never remove concurrency, migration, security or negative-path coverage because a happy-path integration test passes.
- Reuse compatible Spring contexts before increasing parallelism. Different profiles, properties and mock customizers create different context cache keys. Do not add blanket `@DirtiesContext`; document the concrete state that requires eviction.
- Keep database fixtures isolated, avoid order dependencies and shared mutable state, bound every asynchronous wait, and clean up resources through their actual lifecycle owner.
- A required infrastructure failure fails the required gate. A mock or skipped test never establishes a live integration.
- Retries must not turn a flaky required test into accepted evidence. Classify the failure from diagnostics; do not weaken assertions or quarantine a test as a fix.
- Coverage is a diagnostic, not a percentage gate.

The boundary, context-reuse, parallelism and mutation principles are based on Philip Riecks' [Spring I/O 2026 talk](https://www.youtube.com/watch?v=DPi2Borv96I). Commands and gates are in the [testing guideline](guidelines/testing.md).

## API discovery and product boundaries

Published APIs are derived after domain boundaries, not from tables, repositories, entity fields, controller convenience or provider SDKs. Every new API or material contract change follows:

```text
Domain Story and Consumer
→ Visual Glossary
→ Commands, Events and Read Models
→ Context Map and API Product Canvas
→ Synchronous or Asynchronous Surface
→ HTTP or Event Contract
→ Generated Specification
→ Consumer and Runtime Verification
```

1. Name the consumer, goal, authority, frequency, latency and consistency need, and the failure and recovery path before choosing REST, an event, browser navigation or a background operation.
2. Use consumer-facing ubiquitous language. Do not expose persistence joins, framework types, provider SDK objects or internal orchestration names as resources because they exist in code.
3. Separate commands from read models. A read model may compose data from several modules without moving source-of-truth ownership into the HTTP layer.
4. Use resource creation, list and detail where a durable resource is the product concept. Use an explicit POST command for a domain transition on a durable resource; do not label a revoke or withdraw as DELETE when history stays addressable under the same identity.
5. Keep responses minimal and consumer-owned. Expose internal identifiers, lifecycle facts, authority projections and diagnostic metadata only when a current consumer needs them.
6. Model asynchronous work as `202 Accepted` plus a durable status resource with a polling and recovery contract. Do not return success or a problem for work that has not completed.
7. Define idempotency, retries, the concurrency winner, ordering, pagination, bounded filters and sorts, and deletion and retention before publishing an operation.
8. Distinguish browser navigation and capability-link routes from JSON APIs. OpenAPI contains only programmable API contracts; OAuth, logout, callback and invitation-link navigation keep their browser and security contracts.
9. Give every OpenAPI operation a stable consumer-facing `operationId`, product tags, a summary, its security requirement and explicit success and failure responses. Generated controller-class tags are not an API taxonomy.
10. Generate the specification from the implemented contract, verify it against the API Product Canvas and glossary, regenerate clients, and exercise one real consumer flow.

## API errors

The error contract follows [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html) and the machine-readable-reason guidance of [Google AIP-193](https://google.aip.dev/193).

- **Typed failures.** `FailureCategory`, `FailureReason` and the abstract `BusinessException` live in the base package. Each module declares its expected failures as one enum implementing `FailureReason` (stable code, category, safe user message) and throws one module exception that extends `BusinessException`. The exception message is diagnostic and reaches logs only. HTTP types never enter a module's root or persistence code.
- **One handler.** `ApiExceptionHandler` in the `config` module is the application's only exception handler: no other class declares `@ExceptionHandler`, and modules declare no `@ControllerAdvice`, `@RestControllerAdvice` or response advice. A failure that needs more in its response than code, category and message (for example a `Retry-After` delay) exposes it through typed members of its exception, which the single handler maps; every such member is declared on the shared problem schema.
- **Codes.** Codes are upper snake case, start with the module name, match `[A-Z][A-Z0-9_]+[A-Z0-9]` and are at most 63 characters, for example `PROPOSAL_DEADLINE_PASSED`. A published code never changes meaning; a new meaning gets a new code.
- **Status by category.**

  | `FailureCategory` | HTTP status |
  | --- | --- |
  | `VALIDATION` | 400 |
  | `NOT_PERMITTED` | 403 |
  | `NOT_FOUND` | 404 |
  | `CONFLICT` | 409 |
  | `GONE` | 410 |
  | `LIMIT_EXCEEDED` | 429 |
  | `SERVICE_UNAVAILABLE` | 503 |

- **Problem members.** `type` is `urn:beyondpilot:failure:<code in kebab case>` and maps one to one to `code`; `title` comes from the category; `detail` is the safe message; `code` is an extension member declared in the shared problem schema; `requestId` is an extension member equal to the identifier logged for that request.
- **Every error response is `application/problem+json`**: business failures, request validation, Spring MVC errors, uncaught exceptions (a generic 500 with no internal detail) and Spring Security 401 and 403. A test verifies each kind. Uncaught exceptions reach this shape through the framework error path, not through an application `@ExceptionHandler(Exception.class)`, which is never added.
- **Validation failures** return 400 with an `errors` extension: one entry per violation with `pointer` (a JSON Pointer to the offending member, for example `#/title`), `detail` (safe fallback text), `code` and optional `params` holding only allowlisted numeric bounds such as `min` and `max`. A rejected value is never echoed.
- **Retry hints.** 429 and 503 responses carry `Retry-After` in whole seconds; a `LIMIT_EXCEEDED` or `SERVICE_UNAVAILABLE` failure supplies the delay by overriding `BusinessException.retryAfter()`.
- **Consumers.** Clients branch on `status` or `code` (equivalent to `type`), never on `title`, `detail` or diagnostic text. The web translates codes into the reader's language at render time.
- Never put a code into an exception message and match the string later.
- Browser redirects keep their own contract.

## Published API contracts

- Spring MVC controllers, their request and response records, and backend-owned OpenAPI annotations are the source of the API contract.
- Controllers live in their module's `web` subpackage; request and response records live one public top-level type per file in `web/contract/`. Controllers route and map thinly. They never return entities or module root types as HTTP bodies, and never build a second business model.
- Controllers take the authenticated actor as `@CurrentActor`, which combines `@AuthenticationPrincipal` with a hidden OpenAPI parameter.
- Every declared 4xx or 5xx response uses the shared problem schema; a bodiless response is declared with `content = @Content`. Nullable components on API records declare `@Schema(types = {"<type>", "null"})`.
- `openapi.yml` at the repository root is generated by `OpenApiContractTest` from the full application context. Running it with `BEYONDPILOT_OPENAPI_WRITE=true` writes the file; without the flag the test fails on any drift. Never edit the file by hand.
- Runtime configuration keeps springdoc endpoints disabled; contract generation belongs to the test, not to a runtime profile.
- Every API change refreshes `openapi.yml` and the generated web client in `web/src/lib/api/generated` in the same change ([runbook](runbooks/development-runtime.md#refresh-the-api-contract)). `pnpm check` fails when the generated client is stale.
- Every browser-session request other than GET, HEAD and OPTIONS carries `X-BeyondPilot-CSRF: 1`; the backend rejects an unsafe request without it.
- Controllers do not write `Cache-Control: no-store` or `X-Content-Type-Options: nosniff`; Spring Security's default headers send them. Set `Cache-Control` only as a commented, deliberate override.

## Logging

- Log through the SLF4J fluent API (`LOG.atWarn().addKeyValue(...).log(...)`); positional `{}` placeholders are not used.
- Every log carries `event` named `<module>.<subject>.<outcome>` in snake case, for example `proposal.submission.accepted`. Failures add `error_type` (the exception class name) and `error_code` (the typed code when one exists). A handled failure logs these fields without a stack trace.
- INFO records lifecycle transitions, DEBUG stale or no-op details, WARN handled retries and expected failures worth attention, ERROR unhandled failures.
- Never log passwords, tokens, secrets, presigned URLs, request or response bodies, file contents, personal data such as email addresses or phone numbers, or a third party's error text.
- Local development logs readable text. The `staging` and `production` profiles log structured JSON to standard output through Spring Boot structured logging.
- Metrics, tracing and dashboards are tracked separately (BEY-19).

## Data and security

- Follow the [persistence guideline](guidelines/persistence.md).
- Authorization is enforced on the server in application services, never only by hiding interface elements.
- Fail closed on missing configuration, invalid credentials, unknown bindings and ownership conflicts.
- Configuration comes from environment variables prefixed `BEYONDPILOT_`. Deployed environments mount secrets as files; the container entrypoint turns each `BEYONDPILOT_<NAME>_FILE` into `BEYONDPILOT_<NAME>` before the application starts.
- Never write passwords, tokens, private keys, authorization codes or secret values to Git, docs, Linear, logs or command history. Record only where a secret is managed and how to retrieve it.
- Administrative or ownership-changing behavior requires an authorization and audit design; never expose an unauthenticated convenience endpoint.

## Documentation

- One canonical home per fact; link instead of copying.
- `ARCHITECTURE.md` states what exists. `docs/vision.md` states intended outcomes. ADRs state accepted rationale. Guidelines state reusable policy. Specs state module contracts. Increments state change-local design and progress. See the [operating model](guidelines/operating-model.md).
- Update documents in the same change that makes them true.
- Repository documents are written in English.

## Frontend

The browser application in `web/` follows [ADR 0002](decisions/0002-nextjs-frontend-over-the-spring-backend.md). The checklist that points into this section is [web/AGENTS.md](../web/AGENTS.md).

### Stack

- Next.js 16 App Router with the React Compiler, React 19, TypeScript in strict mode, Tailwind CSS 4, shadcn/ui (`base-nova` style on Base UI primitives) and next-intl. New scaffolding comes from the official CLIs (`create-next-app`, `shadcn`); the lockfile is authoritative and upgrades are deliberate changes.
- pnpm is installed directly, not through Corepack; `packageManager` in `web/package.json` records the version.
- A library arrives with its first consumer, never ahead of it. The chosen ones are TanStack Query for client-side server state, TanStack Form with zod for forms, TanStack Table for tables, nuqs for URL state, Hey API for the generated client, and Vitest with Testing Library and MSW for unit tests.

### Structure

- Every page lives under `src/app/[locale]/`. The route groups `(public)` and `(auth)` add no URL prefix; `workspace/` and `admin/` are URL segments with their own layouts.
- Pages are thin: metadata, one data read, then one page component.
- App screens (workspace, admin, review) are organised by business domain in flat feature folders, as in MemoryOS and Dub: `src/features/<domain>/` holds the domain's page components (`campaign-detail-page.tsx`), parts (`campaign-card.tsx`), query and mutation options (`<domain>-queries.ts`) and form schemas (`<domain>-schemas.ts`). A subfolder appears only when a domain grows too many files. A domain is named after the business concept and usually matches a backend module; it imports another domain only in the direction the backend modules depend on each other.
- Public marketing pages are composed from sections, as in Launch UI and the Medusa storefront: `src/components/sections/<section>/` holds one section per folder (hero, logos, faq, cta, …), and the route's `page.tsx` stacks them. A section that shows live product data takes it through props from a feature component; sections never fetch.
- `src/components/ui` holds shadcn registry primitives. `src/components/composites` holds product patterns used by at least two features; they never fetch data or check authority. `src/components/layout` holds headers, footers and navigation.
- `src/components/` never imports from `src/features/` or `src/app/`, so it can later move into a shared package without changes.
- `src/lib/api` holds the generated client and its configuration, `src/lib/auth` the server-only session helpers, `src/i18n` the locale routing, `src/styles/tokens.css` the design tokens, and `messages/` the translation catalogs.

### Rendering, data and auth

- Components are Server Components by default. `"use client"` goes on the smallest leaf that needs state, effects or events; server data reaches it as props.
- Public pages read on the server through `src/lib/api`, forwarding the Spring session cookie. They may use time-based or tagged revalidation; authenticated reads never go through the shared data cache.
- Writes go from the browser straight to Spring with `X-BeyondPilot-CSRF: 1`. Server Actions are not used for writes, so authorization and CSRF protection live in one place.
- The `workspace/` and `admin/` layouts check the current user on the server through `/api/identity/me` and redirect when needed. `src/proxy.ts` handles locale routing only.
- The browser sees one origin. Spring's paths (`/api`, `/login`, `/logout`, `/oauth2`, `/ott`) are rewritten to `BEYONDPILOT_API_ORIGIN` during development and routed by a reverse proxy when deployed.
- The session lives only in httpOnly cookies; tokens are never stored in browser storage.

### Internationalization

- English is the default locale with no URL prefix; Vietnamese lives under `/vi`. A first visit is matched to the browser language.
- Every visible string comes from `messages/en.json` and `messages/vi.json`, typed through `src/i18n/app-config.d.ts`. `pnpm check:messages` fails when the catalogs do not have the same keys. The only exception is `src/app/global-error.tsx`, which replaces the root layout and therefore has no translation provider; its copy is written in both languages inline.
- Dates and times are formatted through next-intl in `Asia/Ho_Chi_Minh`. Deadlines always show their time zone.
- Backend failures are shown by translating the problem `code`; backend text is never displayed.

### Errors, loading and empty states

- `src/app/global-error.tsx` and an `error.tsx` per area show safe copy, Next's `digest` as a reference, and a retry action. Each area has a `not-found.tsx`; unknown paths under a locale render the localized not-found page through `[...rest]`.
- API failures are read as RFC 9457 problems ([API errors](#api-errors)): branch on `status` or `code`, map `errors[].pointer` onto form fields, and show the `requestId` whenever a person is asked to report a problem.
- Each segment that loads data has a `loading.tsx` with skeletons. Every data view designs its loading, empty and failure states.
- Toasts use sonner through a helper that accepts message keys only.
- Server rendering errors are logged as structured JSON through `onRequestError` in `instrumentation.ts`, without a third-party service.

### Design tokens and styling

- Components use semantic tokens only. Tokens live in `src/styles/tokens.css` with light and dark values and are mapped to Tailwind in `src/app/globals.css`. Brand primitives replace the neutral values when GenAI Fund provides the BeyondPilot identity.
- Status roles (`success`, `warning`, `info`, `destructive`) always come with an icon or a label.
- Raw colours, inline styles, arbitrary values, unknown classes and dynamically built class names are lint errors outside `src/components/ui`, through the `@shadcn/lint` rules `no-raw-colors`, `no-inline-styles`, `no-arbitrary-values`, `no-unknown-classes` and `require-static-classes`. A value several features repeat becomes a token.
- A component's appearance comes from its variants and sizes. `shadcn/no-restyle` allows only layout classes (margin, width, position) in `className` on a registry component; a new look is a new variant in the component, added only when the design calls for one.
- `src/components/ui` is exempt from these design-system rules because primitives style their own internals; the rest of ESLint (React Hooks, accessibility, Next.js) still checks it.

### Components

- Choose the layer before writing: an existing `ui` primitive (install a missing one with `shadcn add`, never hand-roll it), then a composite or section, then a feature component, then a page component.
- Files are kebab-case, components are PascalCase, exports are named (default exports only where Next.js requires them), one main component per file, and no barrel `index.ts` files.
- Props extend the native element's props; `ref` is an ordinary prop; `className` is merged last with `cn()`; variants use `cva`; parts are composed (`Card`, `CardHeader`, `CardContent`) rather than passed as convenience props. Base UI primitives take a `render` prop for polymorphism.
- Product actions use the `Button`, `IconButton` and `TextButton` wrappers with `tone` (`default`, `danger`), `prominence` (`primary`, `secondary`, `tertiary`, `internal`), `size` (`sm`, `md`, `lg`) and `pending`. Product code does not pick shadcn button variants directly.
- Every interactive component covers hover, active, focus-visible, disabled, pending (`aria-busy`) and invalid (`aria-invalid`) in both themes. Destructive actions confirm in a dialog whose Cancel receives initial focus.
- Use semantic elements first and Base UI for complex widgets; icon-only controls have an accessible name; buttons default to `type="button"`; everything works from the keyboard.
- Registry primitives under `src/components/ui` are changed as little as possible, and the reason for a change is recorded in its commit.
- Behavior tests sit next to the component. Storybook is not used.

### Quality gates

- `pnpm check` runs ESLint (Next.js core web vitals, TypeScript, React Hooks including the React Compiler rules, and the `@shadcn/lint` rules), Prettier with Tailwind class sorting, `tsc`, the message-catalog check and knip.
- `pnpm test:e2e` runs Playwright on desktop and mobile Chrome against the production build. Every spec runs axe and fails on any serious or critical WCAG 2.2 A/AA finding.
- Baseline security headers are set in `next.config.ts`. A strict Content Security Policy with nonces is a separate decision.
