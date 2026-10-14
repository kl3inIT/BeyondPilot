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
6. **Package Module First:** implement the smallest complete vertical slice as a closed Spring Modulith package module with a narrow public root and internal `web`, `dto`, `persistence`, `adapter` or feature subpackages. A bounded context may contain several modules; a module is not automatically a service or a Gradle project.
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

| Contract                                                                 | Default test boundary                                                                                    |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Business rule, validation, ordering, state transition                    | Plain unit test with real value objects; substitute only external collaborators                          |
| HTTP mapping, binding, validation, JSON or filter behavior               | MVC slice with the relevant security configuration; calling a controller method directly is insufficient |
| SQL, migration, locking, transaction or constraint                       | Repository or application integration test against PostgreSQL and the Flyway migrations                  |
| Module boundary and inter-module events                                  | `@ApplicationModuleTest` for the module; `ModulithArchitectureTest` for the whole structure              |
| Application composition, sessions, actor binding or background lifecycle | Full application context; real HTTP when the transport is part of the contract                           |
| Browser interaction and recovery                                         | Component test for local behavior; browser test for routing, cookies, network and browser-owned behavior |
| Deployed feature acceptance                                              | Authenticated runtime smoke test against the deployed release and its real dependencies                  |

- Do not test generated accessors, framework defaults, private methods, fixed call sequences or source spelling. Architecture and generated-contract drift checks are exceptions because those boundaries are repository contracts.
- Before adding a test, check the module's verification matrix in `docs/tests/` and existing cases. Extend an existing case when it covers the same behavior, boundary and failure mode.
- Test through the public entry point. Do not export a helper, add a constructor or overload, or keep dead code alive only so a test can reach it.
- Remove a test only with an explicit explanation of its missing value or a named replacement that preserves its assertions. Never remove concurrency, migration, security or negative-path coverage because a happy-path integration test passes.
- Reuse compatible Spring contexts before increasing parallelism. Different profiles, properties and mock customizers create different context cache keys. Do not add blanket `@DirtiesContext`; document the concrete state that requires eviction.
- Keep database fixtures isolated, avoid order dependencies and shared mutable state, bound every asynchronous wait, and clean up resources through their actual lifecycle owner.
- A required infrastructure failure fails the required gate. A mock or skipped test never establishes a live integration.
- Retries must not turn a flaky required test into accepted evidence. Classify the failure from diagnostics; do not weaken assertions or quarantine a test as a fix.
- Coverage is a diagnostic, not a percentage gate.

The web application names its three boundaries, a function in Node, a component with Testing Library and a flow in the browser, under [quality gates](#quality-gates).

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

- **Typed failures.** `ErrorCategory`, `ErrorCode` and the abstract `BusinessException` live in the base package. Each module declares its expected failures as one enum `<Module>ErrorCode` implementing `ErrorCode` (stable code, category, safe user message) and throws one module exception that extends `BusinessException`. The exception message is diagnostic and reaches logs only. HTTP types never enter a module's root or persistence code.
- **One handler.** `ApiExceptionHandler` in the `config` module is the application's only exception handler: no other class declares `@ExceptionHandler`, and modules declare no `@ControllerAdvice`, `@RestControllerAdvice` or response advice. A failure that needs more in its response than code, category and message (for example a `Retry-After` delay) exposes it through typed members of its exception, which the single handler maps; every such member is declared on the shared problem schema.
- **Codes.** Codes are upper snake case, start with the module name, match `[A-Z][A-Z0-9_]+[A-Z0-9]` and are at most 63 characters, for example `PROPOSAL_DEADLINE_PASSED`. A published code never changes meaning; a new meaning gets a new code.
- **Status by category.**

  | `ErrorCategory`       | HTTP status |
  | --------------------- | ----------- |
  | `VALIDATION`          | 400         |
  | `NOT_PERMITTED`       | 403         |
  | `NOT_FOUND`           | 404         |
  | `CONFLICT`            | 409         |
  | `GONE`                | 410         |
  | `LIMIT_EXCEEDED`      | 429         |
  | `SERVICE_UNAVAILABLE` | 503         |

- **Problem members.** `type` is `urn:beyondpilot:failure:<code in kebab case>` and maps one to one to `code`; `title` comes from the category; `detail` is the safe message; `code` is an extension member declared in the shared problem schema; `requestId` is an extension member equal to the identifier logged for that request.
- **Every error response is `application/problem+json`**: business failures, request validation, Spring MVC errors, uncaught exceptions (a generic 500 with no internal detail) and Spring Security 401 and 403. A test verifies each kind. Uncaught exceptions reach this shape through the framework error path, not through an application `@ExceptionHandler(Exception.class)`, which is never added.
- **Validation failures** return 400 with an `errors` extension: one entry per violation with `pointer` (a JSON Pointer to the offending member, for example `#/title`), `detail` (safe fallback text), `code` and optional `params` holding only allowlisted numeric bounds such as `min` and `max`. A rejected value is never echoed.
- **Retry hints.** 429 and 503 responses carry `Retry-After` in whole seconds; a `LIMIT_EXCEEDED` or `SERVICE_UNAVAILABLE` failure supplies the delay by overriding `BusinessException.retryAfter()`.
- **Consumers.** Clients branch on `status` or `code` (equivalent to `type`), never on `title`, `detail` or diagnostic text. The web translates codes into the reader's language at render time ([failed requests](#failed-requests)).
- **A new code** arrives with its words: `Errors.<CODE>` in both message catalogs of the web, written in the same change. A code no screen can be refused with (it answers a provider's callback, or ends in a redirect) is listed with its reason in `web/scripts/check-error-codes.mjs` instead. The web's `pnpm check:messages` fails on a code with neither, and on words for a code that is gone.
- Never put a code into an exception message and match the string later.
- Browser redirects keep their own contract.

## Published API contracts

- Spring MVC controllers, their request and response records, and backend-owned OpenAPI annotations are the source of the API contract.
- Controllers live in their module's `web` subpackage; request and response records (the DTOs) live one public top-level type per file in the module's `dto` subpackage. The application service returns the response record, so a read has two shapes, the stored one and the DTO, and no intermediate view. Controllers route thinly: they call an application service, never a repository; they never return an entity as an HTTP body and never build a second business model. A record in the module's root package exists only when another module calls for it.
- Controllers take the authenticated actor as `@CurrentActor`, which combines `@AuthenticationPrincipal` with a hidden OpenAPI parameter.
- Every declared 4xx or 5xx response uses the shared problem schema; a bodiless response is declared with `content = @Content`. Nullable components on API records declare `@Schema(types = {"<type>", "null"})`.
- `openapi.yml` at the repository root is generated by `OpenApiContractTest` from the full application context. Running it with `BEYONDPILOT_OPENAPI_WRITE=true` writes the file; without the flag the test fails on any drift. Never edit the file by hand.
- Runtime configuration keeps springdoc endpoints disabled; contract generation belongs to the test, not to a runtime profile.
- Every API change refreshes `openapi.yml` and the generated web client in `web/src/lib/api/generated` in the same change ([runbook](runbooks/development-runtime.md#refresh-the-api-contract)). `pnpm check` fails when the generated client is stale.
- Every browser-session request other than GET, HEAD and OPTIONS carries `X-BeyondPilot-CSRF: 1`; the backend rejects an unsafe request without it.
- Controllers do not write `Cache-Control: no-store` or `X-Content-Type-Options: nosniff`; Spring Security's default headers send them. Set `Cache-Control` only as a commented, deliberate override.

## Events between modules

A module tells others that something happened with a Spring application event, following [Spring Modulith's guidance on application events](https://docs.spring.io/spring-modulith/reference/events.html).

- **The event.** A public record in the publishing module's root package, named for a past fact (`ProgramChanged`), carrying identifiers only. A listener that needs the state reads it through the publisher's published API, so it always sees the current state and the record never copies personal data into the event store.
- **Publishing.** The application service publishes inside the transaction that made the change, through `ApplicationEventPublisher`. A rolled-back change publishes nothing.
- **Listening.** The listener is a package-private method annotated `@ApplicationModuleListener`: it runs after the publisher's transaction commits, asynchronously, in a transaction of its own, so its failure never undoes the change. It is idempotent and does not depend on order, because a publication can be delivered again.
- **Delivery.** The JDBC event publication registry records a publication for each `@ApplicationModuleListener` in the publisher's transaction and deletes it when the listener completes (`completion-mode: delete`). Incomplete publications are delivered again on startup, which is correct while one instance runs; more than one instance needs a resubmission that only one of them runs. Only `@ApplicationModuleListener` is recorded (`registry-trigger-annotation`), so an in-module `@TransactionalEventListener` stays a plain after-commit call whose event is never stored.
- **Within a module**, an after-commit side effect such as a mail may use `@TransactionalEventListener` with a nested record; it is not part of the module's API.

## Review lifecycle

Whatever GenAI Fund reviews before the public sees it follows one lifecycle ([BEY-76](increments/completed/bey-76-review-lifecycle/design.md), [research](research/2026-10-06-review-lifecycle.md)).

- **Three axes, never one status.** The review is `status`; the owner's choice to show it in the directory is `listed`; GenAI Fund's takedown after approval is `suspended_at` with `suspension_reason` and `suspension_message`. Whether a record is public or eligible for matching is derived from them and never stored.
- **One vocabulary.** `draft` (the owner writes), `in_review` (sent, waits for an operator), `needs_changes` (sent back with a reason; the owner changes it and sends it again), `approved`, `rejected` (refused for good with a reason; only an operator reopens it). A kind uses only the statuses it needs, and a refusal for missing information is a send back, not a rejection.
- **A takedown is reversible** and keeps the review status `approved`; restoring needs no new review.
- **The service guards every transition** and refuses a command from the wrong status with the module's typed `NOT_AWAITING_REVIEW`-style code, so two operators cannot decide twice. Every decision is audited and the owner is told.
- **One badge** renders every status in the web: `components/composites/review-status.tsx`.

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
- Configuration comes from environment variables prefixed `BEYONDPILOT_`. Deployed environments mount each secret as a file named after its variable under `/run/secrets`, which the `production` profile imports as a Spring configtree; a secret never sits in the container's environment, where `docker inspect` and crash reports show it.
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
- A library arrives with its first consumer, never ahead of it. A list is read by a Server Component from the parameters of the URL and drawn with the registry `table` through the `DataTable` composite; a write ends in a router refresh. The libraries in use are nuqs for URL state, TanStack Form with zod for forms, TanStack Table for every table of rows, in manual mode behind the `DataTableView` composite (the server sorts and pages; the library keeps the header state and the selection), Hey API for the generated client, and Vitest for unit tests, with Testing Library on jsdom for the tests of a component. MSW is not installed: it arrives with the first component test that needs an answer from the API. TanStack Query owns server data a screen keeps in the browser. Its first consumer is the proposal wizard’s organization context and edit dialog: the QueryClient is scoped to that wizard, organization mutations refetch their reads, and form values remain in TanStack Form. Every write also ends in a router refresh.

### Structure

- Every page lives under `src/app/[locale]/`. The route groups `(public)` and `(auth)` add no URL prefix; `workspace/` and `admin/` are URL segments with their own layouts.
- Pages are thin: metadata, one data read, then one page component.
- App screens (workspace, admin, review) are organised by business domain in flat feature folders, as in MemoryOS and Dub: `src/features/<domain>/` holds the domain's page components (`campaign-detail-page.tsx`), parts (`campaign-card.tsx`), query and mutation options (`<domain>-queries.ts`) and form schemas (`<domain>-schemas.ts`). A subfolder appears only when a domain grows too many files. A domain is named after the business concept and usually matches a backend module; it imports another domain only in the direction the backend modules depend on each other.
- Public marketing pages are composed from sections, as in Launch UI and the Medusa storefront: `src/components/sections/<section>/` holds one section per folder (hero, logos, faq, cta, …), and the route's `page.tsx` stacks them. A section that shows live product data takes it through props from a feature component; sections never fetch.
- `src/components/ui` holds shadcn registry primitives. `src/components/composites` holds product patterns that features share: `DataTable`, `ConfirmDialog`, `Status`, `Person`, `PageTabs` for the pages of one place, `DetailList` for the facts of a record, `SettingsBlock` for a group of settings. A pattern goes there when a second feature needs it, or from its first use when it is a named pattern of the design system, with its component in Figma. Composites never fetch data or check authority, and are built from the registry primitives. `src/components/layout` holds headers, footers and navigation.
- The state of a record is drawn with `Status`, or with `ReviewStatus` for a review, which fixes the tone of each state (`draft` neutral, `in_review` and `needs_changes` warning, `approved` success, `rejected` and `suspended` destructive, `closed` and `merged` neutral), so a state has one colour on every screen. The registry `badge` is for what classifies a record and does not change with it: an industry, a skill, a count.
- What every page shares on the client is mounted once in `src/components/layout/providers.tsx` under the root layout: the theme, the tooltip provider and the toaster. Tooltips use the provider's delay; a tooltip does not set its own. A provider only some pages need goes in the layout of those pages.
- `src/components/` never imports from `src/features/` or `src/app/`, so it can later move into a shared package without changes.
- `src/lib/api` holds the generated client and its configuration, `src/lib/auth` the server-only session helpers, `src/i18n` the locale routing, `src/styles/tokens.css` the design tokens, and `messages/` the translation catalogs.

### Rendering, data and auth

- Components are Server Components by default. `"use client"` goes on the smallest leaf that needs state, effects or events; server data reaches it as props.
- Every call to an address in `openapi.yml` goes through the generated SDK in `src/lib/api/generated`, configured once in `src/lib/api/client.ts`: the browser calls its own origin, the server calls `BEYONDPILOT_API_ORIGIN`, a request that changes state gets the CSRF header, and a request that fails rejects with `ApiError`. `ApiError` carries `status` (missing when no answer came), `code`, `requestId` and `violations`, the problem's `errors`. Addresses outside the contract (`/ott/generate`, `/login/ott`, `/logout`) are called by hand with the same `csrfHeader`.
- Public pages read on the server through `src/lib/api`, forwarding the Spring session cookie. They may use time-based or tagged revalidation; authenticated reads never go through the shared data cache.
- Writes go from the browser straight to Spring with `X-BeyondPilot-CSRF: 1`. Server Actions are not used for writes, so authorization and CSRF protection live in one place.
- Every page under `workspace/` and `admin/` checks the current user on the server, through `requireAccount` or `requireRole` in `src/lib/auth/session.ts`: a visitor is redirected to sign in with the path to return to, and an account of the wrong role gets the not-found page. The check is in the page, not the layout, because Next.js does not render a layout again when a person moves between its pages. No `loading.tsx` or other Suspense boundary sits above the check, so the answer is a real 307 or 404 rather than a streamed 200. A layout of these areas draws its frame only for an account its pages admit and otherwise returns the page alone, so a refusal carries no frame. `getCurrentAccount` asks `/api/identity/me` once per request. `src/proxy.ts` handles locale routing only.
- Session helpers are named by what they do: `get…` returns the value or `null` and never leaves the page; `require…` returns the value or leaves the page, by a redirect or the not-found page. A role is an argument (`requireRole("operator")`), never part of a function's name.
- The admin area is framed by the stock shadcn `sidebar` with `collapsible="icon"`, unrestyled. Its destinations are one typed list in `src/components/layout/admin-sidebar.tsx`, nested one level at most; the change that adds a screen adds its entry, and no entry points at a screen that does not exist.
- The browser sees one origin. Spring's paths (`/api`, `/login`, `/logout`, `/oauth2`, `/ott`) are rewritten to `BEYONDPILOT_API_ORIGIN` during development and routed by a reverse proxy when deployed.
- The session lives only in httpOnly cookies; tokens are never stored in browser storage.

### Admin page frame

- The top of every admin page is `AdminPageHeader`, in one order: the way back for a page below a destination, then the title with what the record is now (a status, a badge) and one line of lead on the left and the page's actions on the right, the primary one last, then the page's tabs, drawn by `PageTabs`. A top-level page names its destination, whose icon leads the title as the sidebar shows it; on a phone the bar above shows that title instead.
- The bar above the page holds the breadcrumb: the area, the destination, and for a page below a destination a third crumb with the page's own name, a record's page by the record. `AdminPageHeader` hands the bar that name (`AdminCrumb`) whenever it has no `destination` and its title is text, so a page writes nothing for it. The layout cannot read a page's record, so the name joins when the page reaches the browser; a page the frame knows by its address alone (`subpages`, such as "New use case") is named from the first paint. On a phone the bar keeps the destination, and the record's name is the title under it.
- The search and filters of a list sit under the header and are always `FilterToolbar`, which keeps them in the URL as [Lists](#lists) describes. A filter with more options than a reader scans gives them in named groups, as the audit log's actions are grouped by the areas of the sidebar. When a list needs what the toolbar lacks, such as a period that is never off or a cursor to drop on a change, the toolbar gains it for every list; a page never writes a toolbar of its own.

### Lists

- A list's search, filters and page are the URL, written through nuqs with `shallow: false` so a change asks the server again. A value at its default is left out of the URL. Changing the search or a filter returns to page 1. A search field waits 300 ms after the last keystroke.
- The Server Component of the page reads the list with those parameters; nothing about a list is kept in browser state that the URL does not hold. A write goes to Spring from the browser and ends in `router.refresh()`.
- The API pages from 1 and answers `items`, `page`, `pageSize` and `total`; a page past the end is empty, not an error. A list request takes an optional `size` from 1 to 100; absent, the list keeps its own page size, and `pageSize` answers the size used.
- Under a list sits the count of what matches and, when it fills more than one page, the registry `pagination` with page links; a way that does not exist is not offered.
- A table of rows is drawn by `DataTableView`, which wraps TanStack Table in manual mode as Dub and Medusa do: the Server Component sorts and pages, and the composite draws. The columns an operator would rank by (a score, a date, a count, a name) sort from their header, which writes `?sort=key` ascending or `?sort=-key` descending, marks itself with `aria-sort`, and returns to page 1. One column sorts at a time, a second click turns it round, and the list has its own default order, left out of the URL. A key the list does not know falls back to that default.
- Rows an operator acts on together are selected with a box per row and one for the page. The selection gathers in a bar at the bottom of the screen with its count and actions; once the whole page is selected the bar offers every row the search matches, Escape empties it, and a row that leaves the list leaves the selection. A screen has one primary action: while rows are selected it is the bar's leading action, and the page's own primary button is drawn secondary until the selection is empty (`DataTableView`'s `selection.onCount` tells the page). An action on five or more rows, or on any row when it cannot be undone, is asked once with the count ([Actions](#actions)).
- Columns are laid out with the composite's fixed words rather than classes: `fill` takes the room left, `nowrap` keeps one line, `numeric` aligns right, `width` is `action`, `sm`, `md` or `lg`, `from` leaves the column out between 768px and `lg`, `xl` or `2xl`, where the table is made to fit, and `narrow` holds a box.
- A list that holds more than its smallest page offers its page size beside the pagination (`PageSizeSelect`): 10, 25, 50 and 100 for a table, 12, 24 and 48 for a directory of cards. The size is the URL (`size`), and changing it returns to the start of the list.
- A list opens at one size for its kind: 25 rows for a table, 12 for a directory of cards, 50 for a log read from its newest end (audit, email activity, AI usage, MCP activity) and for a program's applications, which are compared and selected as one round. Two keep 10 because of what a row is: the members of one organization, a section of a page, and the public use cases, each a tall card. A new list takes the size of its kind, which is always one the control offers.
- A search field has one size per surface: `DirectorySearch` at 48px in a public directory, the registry `input-group` at 32px in an admin toolbar.
- A list that only grows and is read from its newest end, such as a log, is paged by cursor instead: the address carries `before` or `after`, and under the list sit Previous and Next without a count or page numbers.
- An empty list and a search that finds nothing are different states. The second keeps the header row and offers one action that clears the search and the filters.
- Row actions sit in a menu at the end of the row, opened by `RowMenuTrigger` of `src/components/actions`, the one "⋯" control of every row. The one action a row is waiting for stands beside the menu as a button, so a queue is worked without opening a menu on every row: Review on an organization that waits for review. A destructive action comes last, after a divider, in the destructive colour; an action that opens a dialog ends with an ellipsis. The dialog names who or what it concerns, what will happen and who is emailed; whether an action has a dialog at all follows [Actions](#actions).
- A table is a table at every width. When it does not fit, on a phone above all, its frame scrolls it sideways as the registry `table` does: the frame is then a named region the keyboard reaches, its hidden side is shaded, every column shows, a `fill` column keeps 14rem and an `action` column stays at the end of the frame.
- A page writes no second list for phones, and hides no table below a width.
- A list operators take out of BeyondPilot offers **Export** among the page's actions, the `ExportMenu` composite, with Excel (.xlsx) and CSV. The download is the list as the screen narrows it, every page of it: the endpoint, `POST …/export?format=`, takes the list's own filters and its service reads the list through its own method a page at a time (`Spreadsheet.everyPage`), checks the operator and records the download with its count. The columns are declared once on `shared.Spreadsheet`, by kind, and headers are English ([BEY-96](increments/active/bey-96-spreadsheet-exports/design.md)).

### Forms

- Every form that sends data to the server is built with `useAppForm` and the shared controls of `src/components/form` (`TextField`, `TextareaField`, `SelectField`, `CheckboxField`, `SubmitButton`, `FormError`), whether it has one field or many. Its rules are a zod schema, never checks written by hand; a refused submit reaches the fields through `setServerErrors`; a list that grows is an array field; "unsaved" is that the form differs from what was saved, `!isDefaultValue`, and never `isDirty`, which stays true after a change is put back.
- A form that sits in a dialog uses the `FormDialog` composite, which takes the form and draws the frame around its fields: the title and the line under it, the `<form>` element with its submit, the form-level error above the buttons, then Cancel and the submit button, in that order, with the labels the caller passes. The dialog cannot be closed while the form is being sent, the form starts again every time the dialog has closed, and a body taller than the screen scrolls between the title and the buttons. Its width is one of five steps, and a decision's round mark at its head is an option; a dialog that swaps the form for another state, such as a confirmation that the message was sent, is still built by hand from the `dialog` parts. Closing a dialog returns the focus to what opened it, the row's menu button for one opened from a menu item; where the opener is gone by then, as after a Delete inside the dialog, the caller names the place with `finalFocus`. Nothing inside a dialog uses the `autoFocus` attribute, which moves the focus before the dialog has noted where it was: the dialog's `initialFocus` does it, as `ConfirmDialog` does for Cancel.
- A form written in several steps is one form that holds every step's values. Each step that must hold something before the next opens has a zod schema of its own. Going forward, by Continue or by the list of steps, submits the form, whose validator checks the step on the screen only; going back is never refused. Fields that several forms draw the same way are a field group (`withFieldGroup`), bound to the part of each form that holds them. A draft that is saved as it changes is saved from the form's `listeners.onChange`; whether something still waits to be saved is the saving code's own flag, not `isDirty`, which a save does not clear.
- What a submit refused stays under its field until the value is accepted or the form is submitted again: once a form has been submitted its rules are checked again as the person types and when a field is left, whether they are `onDynamic` rules under `revalidateLogic()` or `onSubmit` ones. Before the first submit only a field's own `onChange` and `onBlur` rules speak.
- A field that must be filled says so to a screen reader with `aria-required` on its control, which the shared controls set from `requiredMark` (the star, hidden from a screen reader) or `required`; the native `required` is never used. A form that says in words that every field is required unless marked Optional wraps its fields in `AllRequired`, and names its exceptions with `optional` or `required={false}`. A control composed by hand takes `required` from `useFieldValidity(marks)`. A group of boxes or of buttons cannot carry `aria-required`: its name ends with `RequiredWord`; a `radiogroup` carries the attribute.
- The error under a field is tied to its control and is not a live region: after a refused submit the focus moves to the first field in error, which is read with its error, and the others are read as the person reaches them. An error announces itself (`role="alert"`) only when nothing moves the focus to it: one set by a field's own `onChange` or `onBlur` rule, and the form-level error.
- A draft that is taken up again opens at the first step that lacks something, and at its last step when none does; a step named in the address is the one shown. The application form (`src/features/apply`) is the one that does so today. Where the last step is a review, each line that is required and missing says so and leads to its step and its field, and the submit is held, with the reason beside it, until no step lacks anything.
- A problem is said once, under its field, and the first field in error takes the focus. A line above a step is kept for what no field can say: a refusal the backend gives without words, or one that names no field.
- The steps of such a form are drawn by the `StepsNav` composite and stay in view while the form scrolls: from 1024px as the list in a column the page keeps still, below that as a bar that sticks to the top of the screen with "Step 2 of 5 · name", how far that is, and a control that opens the list. A step is marked done by its own schema, never by where it stands: one the person has passed that still lacks something says so under its title instead of showing a check, and one they have not reached yet is marked neither way. Under a header that sticks to the top of the screen the bar is placed below it. When the step changes the page starts again at its top and the focus goes to the step's heading.
- A list ordered by hand keeps a key per row for as long as it is open, a row added there included, never the row's place in the list. A move by a button keeps the focus on the row that moved, on the other direction's button once the row is first or last, and says the new place in a live region.
- A field the backend would refuse to change is closed where it stands, with one line that says why (an address once published, when applications open once they have, the cover of a published program), instead of a save that fails.
- A search box and filters are not a form: they are the URL, through `FilterToolbar` ([Lists](#lists), [Admin page frame](#admin-page-frame)). A switch or a button that acts at once is not a form either. Nor is a one-time code input that submits itself, the code step of sign-in (`src/features/identity/check-email.tsx`): it has one input and no rule beyond its length, and its states (locked after too many tries, the wait before another code is sent) are not validation, so it is written on the registry `input-otp` without `useAppForm`.
- A control the shared set lacks (a native select, a combobox, an upload) is composed from the registry `field` parts inside `form.Field`, which holds its value.
- The id of a control, of its hint and of its error is unique in the document: it is the form's id (`form.formId`, React's `useId` unless the caller names one) followed by the field's name, so the form of a dialog shares no id with the form of the page under it. The shared controls write these ids and tie the hint and the error to the control with `aria-describedby`; no caller writes them. A control composed by hand takes the same ids from `src/components/form`: `ids` of `useFieldValidity()` inside `form.AppField`, `fieldIds(field)` inside `form.Field`, and `fieldIdOf(form, name)` for code that moves focus to a field or links to it. An id holds the name as written, dots and brackets included, so an element is found with `getElementById` or an attribute selector, never with `#id`. An id written by hand stays only where it is unique by construction.
- A rule that is one field's alone and should speak before the form does, such as a format said while it is typed or when the field is left, may be that field's own `validators`, beside the form's schema. `useAppForm` keeps the two apart: a submit checks a field by its own rules and leaves what the form found for it in place until the form's rules clear it.
- A field with a length limit shows how much of it is used, at the end of the line that holds the hint. The shared controls show it from `maxLength`: always on a textarea, and on a text input whose limit is 60 characters or more. An address, a key, a number or a telephone number has no counter.
- After a refused submit, focus moves to the first field in error and the field is scrolled into view, without animation for a person who asked for less motion. A control says it is in error with `aria-invalid="true"` on an element that can take the focus; one that cannot is passed over for the next. `useAppForm` and `setServerErrors` do it for a form written `<form id={form.formId}>`.

### Actions

Reversibility comes before confirmation. An action that changes data is classified by two questions: can the data be restored, and does the action tell someone outside the screen at once, by an email or a notification?

- **Restorable and silent** (feature and unfeature, removing a solution from a matching result, a switch nobody depends on): the action runs at once, and its success toast offers **Undo** for as long as the toast stays, which calls the inverse operation. The toast is raised through `useNotify` with its `undo` option. Without an inverse operation in the API the action is not of this kind. Where a person decides many times a minute, as in the one-by-one review of matched solutions, a toast for each decision would stack and cover the controls: the line under the controls says what was just decided and offers **Undo** there, which calls the same inverse operation.
- **Restorable, but it emails someone** (taking down or restoring an organization, a solution or a talent profile; a review decision with a message; an invitation; revoking access): the dialog is a form that takes the reason or the message and says who is emailed. There is no second confirmation and no Undo, because an email cannot be recalled.
- **Not restorable, or reaching outside widely** (releasing outcomes, merging two organizations, really deleting personal data, changing the email provider, switching off the MCP user server): the action is asked once, in `ConfirmDialog`, naming the consequence and the count of what it touches.
- No action asks a person to type a name to confirm.
- An action is drawn with a wrapper of `src/components/actions`: `Button`, `IconButton` for an icon alone (`prominence="tertiary" size="sm"` in a row or a card's header), `TextButton` for a text-only one. A raw `<button>` is written only for what is not an action of that kind: a card or a tile that is one large control, a chip, a table header, and the element a menu, popover or tooltip trigger renders when no wrapper has its look (the menu of a row is `RowMenuTrigger`, [Lists](#lists)).
- A text is copied to the clipboard with `CopyButton` of `src/components/actions`, with words beside a field or as an icon beside a value in a row. It says "Copied" in a live region, keeps its width when its label changes, and tells a refused clipboard in a toast. A menu item that copies ends in a toast instead, and catches the refusal too.
- Unsaved work is guarded in one place, `src/components/composites/leave-guard.tsx`: `LeaveGuard` for a form saved on request, and its `useUnloadWarning` for a page that saves by itself and has only the moments between two saves to protect. Nothing else listens for `beforeunload`.
- Which records are deleted and which change status is in the [persistence guideline](guidelines/persistence.md#deletion).

### Internationalization

- English is the default locale with no URL prefix; Vietnamese lives under `/vi`. The site opens in English for every visitor. The browser's language never chooses a language: `src/proxy.ts` takes it out of the request before locale routing. A person reads Vietnamese after choosing it in the language menu or opening a `/vi` address, and next-intl's locale cookie keeps that choice for the addresses without a prefix until the browser is closed.
- Every visible string comes from `messages/en.json` and `messages/vi.json`, typed through `src/i18n/app-config.d.ts`. `pnpm check:messages` fails when the catalogs do not have the same keys. The only exception is `src/app/global-error.tsx`, which replaces the root layout and therefore has no translation provider; its copy is written in both languages inline.
- The browser receives only the messages its area needs. `src/i18n/message-scope.tsx` lists the catalog paths that client components read, for the root layout and for each area layout; a client component that reads a new namespace adds it there, or it fails with `MISSING_MESSAGE`. Server Components read the whole catalog and are not listed.
- Dates are written one way, as GenAI Fund writes them: day before month ("15 Oct 2026") in English as in Vietnamese, the 24-hour clock, Vietnam time (`Asia/Ho_Chi_Minh`) whoever is reading, and "ICT" after a time whose zone the reader must know, such as a deadline. next-intl has one locale for messages and formatting, and its `en` writes "Oct 15, 2026", so components take the formatter from `src/i18n/format.ts` (`useFormatter`) or `src/i18n/format-server.ts` (`getFormatter`), never from next-intl; ESLint refuses the other import. They are next-intl's formatter with dates in `en-GB` for English; numbers, lists and relative times are unchanged. A date takes one of the shapes named in `src/i18n/formats.ts`: `format.dateTime(at, "day")` ("15 Oct"), `"date"` ("15 Oct 2026"), `"time"` ("23:59"), and `deadlineText` for "15 Oct, 23:59 ICT". An option object is written only for a shape used once. The time zone and the shapes are set once, in the request configuration, and reach client components through the provider, so the server and the browser never disagree on the zone.
- Backend failures are shown by translating the problem `code`; backend text is never displayed ([failed requests](#failed-requests)).

### Help text

The words that explain a screen: the line under a title, the hint under a field, a note beside an action. What each rule rests on is in the [research note](research/2026-10-10-help-text.md).

- Text that repeats its label or title is removed, not moved. Help text answers a question the reader has at that point.
- What most people need to act correctly is shown where they act: the format a field takes, a limit, a deadline.
- Help text that is shown is one short sentence without a link.
- What an action leads to is shown beside the action: that it cannot be changed afterwards, who reads what is written, who is emailed.
- What only some people need, such as what a term means, is behind a control that opens on a click or a tap: a disclosure or a popover.
- A tooltip that opens on hover holds no information. It names a control that is only an icon, and nothing else.
- A placeholder is not a hint or an example: it leaves when typing starts, and it reads as a value already there.

### Action words

One action has one word, on a button, a menu item, a link that acts and the `aria-label` that names it, in both languages. A dialog's title and the toast that follows use the word of the button.

| Action                                           | English                                | Vietnamese                   |
| ------------------------------------------------ | -------------------------------------- | ---------------------------- |
| Save a form that edits what exists               | Save changes                           | Lưu thay đổi                 |
| Save for the first time, or in a small dialog    | Save                                   | Lưu                          |
| Save a draft                                     | Save draft                             | Lưu nháp                     |
| Save and do something more                       | Save and exit, Save and publish        | Lưu và thoát, Lưu và công bố |
| Throw unsaved changes away                       | Discard changes                        | Bỏ thay đổi                  |
| Leave a form or a dialog without doing the thing | Cancel                                 | Hủy                          |
| Shut what only shows                             | Close                                  | Đóng                         |
| Open something to change it                      | Edit                                   | Sửa                          |
| Replace one value (a model, a photo, an answer)  | Change                                 | Đổi                          |
| End the thing itself                             | Delete                                 | Xóa                          |
| Take out of a list or a relation                 | Remove                                 | Gỡ                           |
| Empty the search and filters of a list           | Clear filters                          | Xóa bộ lọc                   |
| Empty a search that has no filters               | Clear search                           | Xóa tìm kiếm                 |
| Empty a selection                                | Clear selection                        | Bỏ chọn                      |
| Send a record to GenAI Fund's review             | Send for review, Send for review again | Gửi duyệt, Gửi duyệt lại     |

- **Save.** "Update" is not a word for saving. A save names its object ("Save offers") only where two saves stand on one screen.
- **Delete or Remove.** Delete ends the thing: a draft, a provider, an offer, a profile. Remove takes it out of a list or a relation while it, or the record that holds it, lives on: a member from an organization, a judge from a program, a model from a provider, a file from a field, a row from a form that is not saved yet. A soft delete still reads Delete when the person thinks of the thing as gone. Withdraw, Take down, Hide, Unpublish and Decline keep their own words.
- **Cancel.** The safe choice of a confirmation may name what it keeps instead: "Keep it", "Keep editing".
- **Review.** What is sent is then "In review". An application to a program is the exception: it is submitted ("Submit application"), and its status is "Submitted".
- **Vietnamese spelling.** The tone mark sits where the catalog had it most: "Xóa", "Hủy", "khóa", "hóa", "thỏa", never "Xoá", "Huỷ", "khoá", "hoá", "thoả". A file is "tệp" and an application is "đơn".

### Errors, loading and empty states

- `src/app/global-error.tsx` and an `error.tsx` per area show safe copy, Next's `digest` as a reference, and a retry action. Each area has a `not-found.tsx`; unknown paths under a locale render the localized not-found page through `[...rest]`. The admin area's stands inside its frame for an operator, whose link to a record that is gone keeps the sidebar and a way to the admin home; for anyone else it draws the page any unknown address gets, as the layout draws them no frame ([rendering, data and auth](#rendering-data-and-auth)).
- API failures are read as RFC 9457 problems ([API errors](#api-errors)): branch on `status` or `code`, map `errors[].pointer` onto form fields, and show the `requestId` whenever a person is asked to report a problem.
- <a id="failed-requests"></a>**Failed requests.** The words for a failure code live in one place, `Errors.<CODE>` in both catalogs, with `Errors.unknown` for a failure that has none; a code is unique across the backend and several screens meet the same one. They say what happened and what the person can do, without the code and without blame. A screen never keeps a list of codes to choose a message: a toast is `notify.failure(error)`, and text shown in place (at a field, above a form) is `useFailureWords()(error)`; both rest on `failureKey` in `src/lib/api/failure.ts`. A screen passes its own words only where the general ones would be wrong there: `otherwise`, what did not happen ("The use case was not saved"), for a failure without words, and its own message for a code whose remedy differs on that screen (a field that can name the file kinds it takes, a step of a form). A screen branches on a code only when the refusal changes what it does (shows it at a field, reloads, stops saving, reads as "nothing here"), and asks with `failedWith(error, "CODE")`, which compiles only for a code that has words. `Errors` is sent to every area; the codes only an operator's screens meet (`AI_`, `SEARCH_`, `NOTIFICATION_`, `PROGRAM_`) go to the admin area alone, and elsewhere fall back to the general words.
- Every data view designs its loading, empty and failure states. The loading state is a skeleton built from the registry `skeleton`: the page's own containers, the title and lead it already knows, and blocks or empty shells the size of the content to come, so nothing moves when the data arrives. `LoadingStatus` names it for assistive technology and the blocks are hidden from it. A skeleton is written once per shared frame, not per page: `DirectoryGridSkeleton` for the public directories of cards, and one beside the feature for a frame only it has.
- A `loading.tsx` starts the response as a streamed 200, so it goes only on a segment where no page at or below it calls `requireAccount`, `requireRole`, `redirect` or `notFound`; above one it would turn the 307 or 404 into a 200 ([rendering, data and auth](#rendering-data-and-auth)). A public list whose segment also holds record pages therefore sits in a `(list)` route group with its `loading.tsx`, which leaves the URL as it is and the record pages outside the boundary.
- A page that checks the account may show a skeleton only below the check: the page keeps every call that can redirect or answer not-found, and an async child under `<Suspense>`, keyed by the search parameters that change the data, reads what is left. A read whose failure or result decides a redirect or a not-found stays above the boundary.
- Every area with a layout has its own `error.tsx` showing `ErrorNotice`, so a page that fails is replaced inside the area's frame and its navigation stays. An error page keeps only what a layout above it draws, and it is a Client Component, so it cannot draw a frame that reads the session. Under `workspace/` the frame therefore belongs to the layout of each section (a route group such as `(list)` where a segment also holds pages without the frame), and each such layout has an `error.tsx` beside it; a page that mounts `WorkspaceFrame` itself loses the frame when it fails, and its notice stands alone in `<main>`.
- Toasts use sonner; the one `Toaster` is mounted in `src/components/layout/providers.tsx`. They are raised through a helper that accepts message keys only, which is written with its first caller. They appear at the top right on the pastel ground of their kind, and every toast closes by itself after four seconds. Every decision or change a reader makes ends in a toast that says its outcome, unless the screen itself shows a confirmation.
- Server rendering errors are logged as structured JSON through `onRequestError` in `src/instrumentation.ts`, without a third-party service: `event` `web.render.failed`, the error's type, its `digest` (the reference the error screen shows) and the route pattern, never the error's text, the query string or headers.

### Design tokens and styling

- Components use semantic tokens only. Tokens live in `src/styles/tokens.css` with light and dark values and are mapped to Tailwind in `src/app/globals.css`. The palette behind them is described in `DESIGN.md`.
- Status roles (`success`, `warning`, `info`, `destructive`) always come with an icon or a label.
- Raw colours, inline styles, arbitrary values, unknown classes and dynamically built class names are lint errors outside `src/components/ui`, through the `@shadcn/lint` rules `no-raw-colors`, `no-inline-styles`, `no-arbitrary-values`, `no-unknown-classes` and `require-static-classes`. A value several features repeat becomes a token.
- A page a client drew for its own program (the written pages in `src/features/program`, [program spec](specs/program.md#pages)) is the one exception: it keeps the measures, colours and fonts of that drawing in a CSS module beside it, under custom properties prefixed by the program, and loads those fonts in its own feature, so nothing reaches another page; it still uses the site's components where the drawing has no look of its own. The site itself is set in Inter ([DESIGN.md](../DESIGN.md)); a change of the site's typeface is a decision about its identity, taken by the owner and recorded there.
- A component's appearance comes from its variants and sizes. `shadcn/no-restyle` allows only layout classes (margin, width, position) in `className` on a registry component; a new look is a new variant in the component, added only when the design calls for one.
- `src/components/ui` is exempt from these design-system rules because primitives style their own internals; the rest of ESLint (React Hooks, accessibility, Next.js) still checks it.

### Motion

Motion shows a change: where something came from, where it went, what an action did. What each rule rests on is in the [research note](research/2026-10-13-motion-and-charts.md).

- An animation that explains nothing is removed. Decorative motion belongs to the marketing pages; in `admin/` and `workspace/` motion serves feedback, state and continuity only.
- Durations are a named scale, never a number written on a page: `duration-fast` (100ms) for hover, press and focus, `duration-base` (200ms) for what appears, leaves or changes state, `duration-slow` (300ms) for a change of size or position. A chart draws in 400ms (`chartDrawMs` in `src/lib/motion.ts`). Which step a change takes is a judgement by how far it travels and how large it is. The landing keeps its own longer, authored sequences.
- An entrance decelerates (`ease-entrance`); an exit is shorter than its entrance. A spring is allowed when it does not overshoot; nothing bounces.
- Animate `transform` and `opacity`. Outside `components/ui`, `transition-all` is not written: the properties are named. A block that appears or goes inside a page, such as an error under a field, goes through `Reveal`, which grows it into place and follows its content's height; a section a person opens is the registry `collapsible`. Neither is a height transition of its own. A figure that changes in place, such as a total when its period changes, is a `CountingNumber`; one drawn once is plain text. An item that leaves or joins a list on a person's decision, such as a matched solution removed or restored, is a `PresenceItem` of a `PresenceList` and folds away or unfolds, as in Dub; the rows of a table, which a refresh redraws, do not move.
- An entrance starts from at least 95% of its size and travels a short way, from the side of its trigger.
- The interface answers at once. An animation never delays the next action, and it gives way when the person acts again.
- An action repeated many times a day has no animation: a keyboard shortcut, the next page of a table, the next record of a queue.
- A skeleton or spinner waits about 200ms before it shows, then stays long enough not to flash.
- With `prefers-reduced-motion: reduce`, movement and scaling are dropped and the change is shown by opacity or at once. No screen depends on an animation to be understood.
- CSS first, then `motion` for what CSS cannot do: a height that follows changing content, an item leaving a list, a number that counts. It is loaded as `LazyMotion` with `domAnimation` and `m` components, never the full `motion` component; a drag needs `domMax`, which is loaded with the one screen that has one (the one-by-one review of matched solutions) and not with the page. It takes its durations and curves from `src/lib/motion.ts`, the same steps as the classes. Its height and position animations do not follow the motion preference by themselves: a component reads `useReducedMotion` and drops them.

### Charts

- A chart is drawn when the shape of the numbers changes what the reader does. A handful of numbers is text.
- Every chart is Recharts through the registry `chart` (`ChartContainer`), with colours from the semantic tokens. One measure per axis; never two scales on one chart.
- A chart sits in the `ChartFrame` composite: its title, one line that says what to read from it, the way to the page behind it, then the chart. The same figures are on the page as text, and the chart has a description for a screen reader.
- A number with its trend is the `StatCell` composite: the label, the number, one line under it, and room at its side for a small chart from 768px. A small chart there has no axis and no tooltip, shows one series over a stated period, and is used only where the page holds no full chart of that series.
- A line or an area uses the `monotone` curve, which never draws a value the data does not have. A chart draws in `chartDrawMs`; Recharts drops the animation for a person who asked for less motion.
- Identity is never colour alone: two series or more have a legend, and a status colour keeps its meaning (`destructive` is a failure, in a chart as elsewhere).

### Components

- Choose the layer before writing: an existing `ui` primitive (install a missing one with `shadcn add`, never hand-roll it), then a composite or section, then a feature component, then a page component. Before writing markup for a pattern, look for its primitive: a table is `table`, paging is `pagination`, an empty state is `empty`, a confirmation is `alert-dialog`, a row menu is `dropdown-menu`, a trail is `breadcrumb`. Where the shadcn documentation gives a change for Next.js, that change is made in the primitive: `pagination` renders the locale-aware `Link`.
- Files are kebab-case, components are PascalCase, exports are named (default exports only where Next.js requires them), one main component per file, and no barrel `index.ts` files.
- Props extend the native element's props; `ref` is an ordinary prop; `className` is merged last with `cn()`; variants use `cva`; parts are composed (`Card`, `CardHeader`, `CardContent`) rather than passed as convenience props. Base UI primitives take a `render` prop for polymorphism.
- Product actions use the `Button`, `IconButton` and `TextButton` wrappers with `tone` (`default`, `danger`, `success` for the approving one of a pair of decisions), `prominence` (`primary`, `secondary`, `tertiary`, `internal`, `inverse` for the ink-coloured action of the landing and the header), `size` (`sm`, `md`, `lg`; `Button` also has `xl` for the one action a page leads to) and `pending`. Product code does not pick shadcn button variants directly.
- One choice among a few, a score on a scale included, is a radio group whatever it looks like: the registry `RadioGroup`, with `RadioGroupItem` for the dot or `RadioGroupToggle` for the look of a toggle. `ToggleGroup` is for choices that are switched on and off independently.
- Every interactive component covers hover, active, focus-visible, disabled, pending (`aria-busy`) and invalid (`aria-invalid`) in both themes. A solid action darkens under the pointer, to its `primary-hover`, `destructive-hover` or `success-hover` token, so its text keeps 4.5:1 there; a fill is never lightened by drawing it at less than full opacity. An action that is asked first ([Actions](#actions)) is asked in a dialog whose Cancel receives initial focus.
- Use semantic elements first and Base UI for complex widgets; icon-only controls have an accessible name; buttons default to `type="button"`; everything works from the keyboard.
- Registry primitives under `src/components/ui` are changed as little as possible, and the reason for a change is recorded in its commit.
- Behavior tests sit next to the component. Storybook is not used.

### Quality gates

- `pnpm check` runs ESLint (Next.js core web vitals, TypeScript, React Hooks including the React Compiler rules, and the `@shadcn/lint` rules), Prettier with Tailwind class sorting, `tsc`, the unit tests, the message-catalog check with the failure-code check ([API errors](#api-errors)) and knip.
- A web test is written at one of three boundaries, the narrowest that can catch the regression ([testing](#testing)); the name of the file says which. The first two are Vitest files next to what they test, run together by `pnpm test:unit`.
  - **A function, in Node** (`*.test.ts`): a rule that needs no screen, such as a schema, a parser, the wording of a value, or the API client against stood-in answers. Pick it whenever the behavior can be asked of a function.
  - **A component, with Testing Library** (`*.test.tsx`, drawn in jsdom): what one component does with its props and a person's clicks and keys, such as which element takes the focus, what a control is named and described by, what is written to the URL, what a dialog refuses while it sends. Pick it when the behavior is in the markup or in the state of a component and needs no layout, no navigation and no server. It draws through `render` of `src/test/render.tsx`, never Testing Library's own, and finds elements by role and name as a person does ([component tests](guidelines/testing.md#component-tests)).
  - **A flow, in the browser with Playwright** (`tests/e2e`, `pnpm test:e2e`, on desktop and mobile Chrome against the production build): what needs a real browser or the whole application, such as routing, cookies and the session, layout and scrolling, a journey across pages. Every spec runs axe and fails on any serious or critical WCAG 2.2 A/AA finding.
- Baseline security headers are set in `next.config.ts`. A strict Content Security Policy with nonces is a separate decision.
