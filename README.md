# BeyondPilot

BeyondPilot connects enterprises that have business problems with AI solution providers and AI talent who can solve them. GenAI Fund runs campaigns and challenges on it: an enterprise publishes use cases, providers register and apply, reviewers assess the proposals and shortlist providers. The client's scope is in the [product brief](docs/brief/BeyondPilot-Vendor-Product-Brief-and-Scope.md).

The repository holds one Spring Boot backend, one Next.js web application and the documents that describe them. It is at the foundation stage: the error contract, the API contract pipeline, the public home page and continuous integration exist; no business capability is implemented yet. [ARCHITECTURE.md](ARCHITECTURE.md) states exactly what exists.

## Start here

- [AGENTS.md](AGENTS.md): the navigation map and the working rules, for people and coding agents alike.
- [ARCHITECTURE.md](ARCHITECTURE.md): the system as it is implemented today.
- [docs/vision.md](docs/vision.md): the outcomes the product is meant to reach.
- [docs/conventions.md](docs/conventions.md): the engineering rules for all code.
- [docs/runbooks/development-runtime.md](docs/runbooks/development-runtime.md): running the system on your machine.

## Requirements

- JDK 25. The Gradle wrapper downloads Gradle itself.
- Docker, for the local PostgreSQL and for integration tests.
- Node.js 24 and pnpm 11.27.1, installed directly rather than through Corepack.

Versions, Windows notes and environment variables are in the [development runtime runbook](docs/runbooks/development-runtime.md).

## Modules

| Path | Holds |
| --- | --- |
| `backend/` | The Spring Boot application; its modules are Spring Modulith packages ([backend guide](docs/guidelines/backend.md)) |
| `web/` | The Next.js App Router application, in English and Vietnamese ([web guide](web/AGENTS.md)) |
| `openapi.yml` | The API contract, generated from the backend and consumed by the web; never edited by hand |
| `docs/` | Brief, vision, conventions, guidelines, decisions and runbooks ([operating model](docs/guidelines/operating-model.md)) |
| `gradle/`, `settings.gradle.kts`, `gradlew` | The Gradle wrapper and the version catalog `gradle/libs.versions.toml` |
| `.github/` | Continuous integration and Dependabot |

## Build and verify

Run from the repository root.

```text
./gradlew :backend:bootRun      # backend on port 8080; starts PostgreSQL through Docker Compose
pnpm --dir web install
pnpm --dir web dev              # web on port 3000

./gradlew :backend:check        # backend gate; needs Docker
pnpm --dir web check            # web gate
pnpm --dir web test:e2e         # Playwright against the production build
```

The same gates run in CI on every branch push ([testing guideline](docs/guidelines/testing.md#continuous-integration)).

## Refresh the generated API contract

A change to a controller, its records or the shared problem schema regenerates `openapi.yml` and the web types in the same change. The commands are in the [runbook](docs/runbooks/development-runtime.md#refresh-the-api-contract).

## Deployment

No deployed environment exists yet. The backend has `production` and `staging` profiles that read their database from environment variables ([profiles and environment variables](docs/runbooks/development-runtime.md#profiles-and-environment-variables)); hosting is not decided.

## Engineering policies

- [Engineering conventions](docs/conventions.md) and the topic guidelines under [docs/guidelines/](docs/guidelines/).
- Accepted architecture decisions under [docs/decisions/](docs/decisions/).
- How documents are organized and kept true: the [operating model](docs/guidelines/operating-model.md).
- Secrets are managed outside Git and never written to the repository, its documents or its logs ([data and security](docs/conventions.md#data-and-security)).
