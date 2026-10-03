# Backend guide

For work in `backend/`: one Spring Boot application whose modules are Spring Modulith packages ([ADR 0001](../decisions/0001-single-spring-boot-application-with-modulith-modules.md)). This page is a checklist that points to the canonical rule; it does not restate it. When a rule here and its linked source disagree, the linked source wins.

## Where things live

| Location | Holds | Never holds |
| --- | --- | --- |
| `ai.genaifund.beyondpilot` (base package) | `BeyondPilotApplication` and the shared failure types `BusinessException`, `FailureReason`, `FailureCategory`. Types here belong to no module, and every module may use them | Anything else |
| `ai.genaifund.beyondpilot.shared` | Identifiers and values that several modules carry, and technical utilities that at least two modules need and that know nothing about any module | Spring beans, persistence, configuration, a module's rules, a dependency on any module |
| `ai.genaifund.beyondpilot.config` | Cross-cutting HTTP configuration that no module owns: Spring Security (`SecurityFilterChain`, CSRF header check, session), the error path (`RequestIdFilter`, `ApiExceptionHandler`, `RequestIdProblemAdvice`, `ProblemErrorController`), OpenAPI configuration | A module's business behavior, and configuration a single module owns (its client, properties or scheduler stays in that module) |
| `ai.genaifund.beyondpilot.<module>` | The module's published API: application services, events, its `FailureReason` enum and its exception, and the identifiers and records another module calls for | SQL, a record no other module uses |
| `<module>.web` | Controllers | Business rules, SQL, entities as HTTP bodies |
| `<module>.dto` | Request and response records, returned by the application service and by the controller | Entities, behavior |
| `<module>.persistence` | JPA entities, Spring Data repositories, `JdbcClient` repositories | Authorization, validation, orchestration |
| `<module>.adapter` | Implementations of the [interchangeable-implementations pattern](../conventions.md#interchangeable-implementations-strategy-behind-a-registry) | Code with only one implementation by nature |
| `<module>.<feature>` | Internal implementation of one feature, with its own `persistence` package when needed | Types another module must use |
| `backend/src/main/resources/db/migration` | Flyway migrations ([persistence](persistence.md#schema-ownership)) | Edits to an applied migration |

Every direct subpackage of the base package, `shared` and `config` included, is a Spring Modulith module. It declares `@ApplicationModule(type = Type.CLOSED, allowedDependencies = {...})` and `@NullMarked` in its `package-info.java`, and it is listed in `ModulithArchitectureTest`. Subpackages declare `@NullMarked` only. A module is created with its first code after [boundary discovery](../conventions.md#boundary-discovery); no module is predeclared.

## Rules to check before you edit

- **Module boundary.** A module is closed and lists its allowed dependencies. Its root package is the published API; `web`, `dto`, `persistence`, `adapter` and feature subpackages are internal. A new dependency edge needs an architecture decision ([change design](../conventions.md#change-design)).
- **No speculative structure.** No empty packages, single-implementation interfaces, temporary runtime modes or one-shot endpoints ([change design](../conventions.md#change-design)).
- **Interchangeable implementations.** A choice among vendors or protocols uses the [Strategy-behind-a-registry pattern](../conventions.md#interchangeable-implementations-strategy-behind-a-registry) from the first vendor.
- **Persistence.** SQL, row mapping, locks and bulk writes live in the module's `persistence` package; application services own authorization, validation, orchestration and the transaction boundary ([persistence](persistence.md#implementation-boundaries)).
- **Nullness and records.** `@NullMarked` everywhere, `@Nullable` for optional values, records constructed by shape, no Lombok ([Java and Gradle](../conventions.md#java-and-gradle)).
- **Failures.** Expected failures are the module's typed exception carrying a `FailureReason`; the single `config.ApiExceptionHandler` turns them into RFC 9457 problems, and no module adds its own handler ([API errors](../conventions.md#api-errors)).
- **HTTP contract.** Controllers in `web`, request and response records in `dto`, `@CurrentActor` for the caller, and `openapi.yml` refreshed in the same change ([published API contracts](../conventions.md#published-api-contracts)).
- **Logging.** Fluent SLF4J with `event`, `error_type` and `error_code`; no secrets, payloads or personal data ([logging](../conventions.md#logging)).
- **Security.** Server-side authorization, exact security identifiers, fail closed on missing configuration ([data and security](../conventions.md#data-and-security)).
- **Reuse the framework.** Check Spring Boot, Spring Modulith, Spring Data and Spring Security before writing an equivalent ([reference-based design](../conventions.md#reference-based-design-and-scope-control)).

## Tests

- Pick the narrowest boundary that catches the regression ([testing policy](../conventions.md#testing)); commands and gates are in the [testing guideline](testing.md).
- `ModulithArchitectureTest` (module structure) and `OpenApiContractTest` (API contract) are boundary tests of the repository. Never weaken them to make a change pass.
- Update the module's matrix in `docs/tests/<module>.md` when a contract changes.

## Common mistakes

- Importing another module's `web`, `dto`, `persistence`, `adapter` or feature package.
- Returning an entity as an HTTP body instead of a `dto` record, or adding a view record between the entity and the DTO that no other module uses.
- Encoding a failure code in an exception message and matching the string.
- Adding an `@ExceptionHandler` or `@ControllerAdvice` inside a module, or an `@ExceptionHandler(Exception.class)` anywhere.
- Adding a `Default*` implementation behind a single-implementation interface, or a constructor only a test calls.
- Creating an empty module package for later.
- Editing an applied migration instead of adding the next version, once the [schema evolution](persistence.md#schema-evolution) allowance has ended.
- Changing a controller without regenerating `openapi.yml`.
- Logging an exception message from a third party, a request body or personal data.
