# ADR 0001: Single Spring Boot application with Spring Modulith modules

- Status: Accepted
- Date: 2026-10-01
- Decision owner: BeyondPilot team

## Context

BeyondPilot Phase 1 must deliver the campaign-to-shortlist journey in about two weeks; submissions for the AI for Insurance Challenge close on 2026-10-15. One small team builds it.

The team's reference project, MemoryOS, splits its backend into several Gradle projects (`core`, `api`, `worker`, `sources`) because it runs separate API and worker processes, bundles provider integrations and does heavy background processing. BeyondPilot has none of these needs yet: one HTTP application, PostgreSQL, object storage and light background work such as email.

## Decision

- The backend is one Gradle subproject, `backend/`, generated with Spring Initializr (Spring Boot 4.1.1, Java 25, Spring Modulith 2.1.1). The Gradle wrapper and `settings.gradle.kts` live at the repository root with `include("backend")`.
- Modules are Spring Modulith package modules. Each direct subpackage of `ai.genaifund.beyondpilot` is one closed module with explicit allowed dependencies, verified by `ModulithArchitectureTest`.
- The base package holds only the application class and the shared failure types `BusinessException`, `FailureReason` and `FailureCategory`, which belong to no module.
- `shared` holds identifiers, values and technical utilities that at least two modules need. It has no Spring beans and depends on no module.
- A module's root package is its published API. Its `web` (controllers and `contract` records), `persistence`, `adapter` and feature subpackages are internal.
- A module is created with its first code, after boundary discovery. No module is predeclared.
- A Gradle split or a separate deployable is added only with the evidence named in step 8 of [boundary discovery](../conventions.md#boundary-discovery), and recorded in a new ADR.

## Alternatives considered

- **MemoryOS's multi-project layout.** Gradle would enforce boundaries in addition to Modulith, but it adds build configuration and a second runtime that no current requirement needs. Modulith verification gives the module boundary inside one project.
- **Separate services.** No team, scaling or failure boundary justifies a distributed deployment; it would add network contracts and operating cost.

## Consequences

- One build (`./gradlew :backend:check`), one image and one runtime.
- Module boundaries are enforced by `ModulithArchitectureTest`, not by the compiler; the test must stay green.
- Cross-cutting HTTP concerns (error handling, OpenAPI, security) need their own module.
- Background work runs inside the application until a measured need, such as load or failure isolation, justifies a separate worker.
