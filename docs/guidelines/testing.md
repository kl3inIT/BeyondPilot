# Testing and verification

## Choose the boundary

The test policy and the boundary-selection table are in [engineering conventions](../conventions.md#testing). Apply them before choosing an annotation or writing another test. Module matrices under `docs/tests/` name the existing checks for each contract.

## Local execution

- Docker must be running. Integration tests start PostgreSQL through Testcontainers: `TestcontainersConfiguration` (`backend/src/test/java/ai/genaifund/beyondpilot/`) declares the container as a `@ServiceConnection` bean.
- Run commands from the repository root; on Windows use `gradlew.bat`.

  ```text
  ./gradlew :backend:test --tests '*SomeTest'
  ./gradlew :backend:check
  ```

- `TestBeyondPilotApplication` starts the application against the same Testcontainers PostgreSQL through `./gradlew :backend:bootTestRun`, without the Docker Compose file.
- Unit tests need no Docker; only tests that start a Spring context with the database do.

## Required gates

1. Run focused tests while changing a contract.
2. Run `./gradlew :backend:check` before opening a pull request. It requires a working Docker daemon.
3. Exercise the changed runtime surface: start the application ([development runtime](../runbooks/development-runtime.md)) and call the changed endpoint, not only compile and test.
4. An API change regenerates `openapi.yml` in the same change ([published API contracts](../conventions.md#published-api-contracts)).
