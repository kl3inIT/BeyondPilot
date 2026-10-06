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

## Continuous integration

`.github/workflows/ci.yml` runs on every branch push, so a branch is verified before `main` is fast-forwarded onto it. A newer push to the same branch cancels the older run.

| Job                   | Runs                                                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workflows and secrets | actionlint on the workflows, shellcheck on the deployment scripts, and gitleaks over the full history                                                    |
| Backend               | `./gradlew :backend:check` on Temurin 25, with Testcontainers on the runner's Docker                                                                     |
| Web                   | `pnpm --dir web check`, then `pnpm --dir web audit --audit-level=high`                                                                                   |
| Web end-to-end        | `pnpm --dir web test:e2e` on Chromium, desktop and Pixel 7; CI splits it across four shards with `--shard=N/4`                                          |
| Images                | Builds both images, starts the local composition from them, checks the proxy's routes and the revision labels; on a main push, pushes the images to GHCR |
| Publish release       | On a main push, after every other job: the `release-<sha>` artifact that [Deploy staging](../runbooks/ci-cd.md) promotes                                 |

- Actions are pinned to commit SHAs; Dependabot (`.github/dependabot.yml`) proposes Gradle, pnpm, Actions and base-image upgrades weekly, grouped by risk class and at least three days after publication.
- A high advisory fails the web job. Fix it by upgrading; when the vulnerable version is pinned by a dependency, override it in `web/pnpm-workspace.yaml` with a comment naming the advisory and when to drop it.
- A failed job uploads its test or Playwright report as a run artifact for seven days.
