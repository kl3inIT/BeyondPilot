# Development runtime runbook

## Prerequisites

- JDK 25 as `JAVA_HOME`. Verified with Temurin 25.0.2.
- Docker with the Compose plugin. Verified with Docker 29.7.2.
- No system Gradle: the wrapper at the repository root downloads Gradle 9.8.0.

## Run locally

From the repository root:

```text
./gradlew :backend:bootRun
```

- Spring Boot Docker Compose support (`spring-boot-docker-compose`, a development-only dependency) starts PostgreSQL from `backend/compose.yaml` and connects the application to it. No datasource settings are needed.
- The application listens on port 8080. `http://localhost:8080/actuator/health` returns `"status":"UP"`.
- If the process is killed instead of stopped, the PostgreSQL container keeps running. Remove it with:

  ```text
  docker compose -f backend/compose.yaml down
  ```

- The database is `postgres:18.6` with development-only credentials in `backend/compose.yaml`. Its data lives in the named volume `backend_postgres-data` and survives `down`; `down -v` deletes it.
- On Windows, call the JDK through `JAVA_HOME` when running the jar by hand; a `java` found first on the Git Bash `PATH` may not be JDK 25.

## Profiles and environment variables

Local runs use no profile. Deployed environments run `production`; staging runs `production,staging`.

| Variable | Profile | Purpose |
| --- | --- | --- |
| `BEYONDPILOT_DATABASE_URL` | `production` | JDBC URL of the PostgreSQL database. No default |
| `BEYONDPILOT_DATABASE_USERNAME` | `production` | Database login. No default |
| `BEYONDPILOT_DATABASE_PASSWORD` | `production` | Database password; a managed secret, never committed. No default |
| `BEYONDPILOT_DATABASE_POOL_SIZE` | all | Fixed connection pool size. Default `10` |

- `production` writes Logstash-format JSON logs to standard output; `staging` adds DEBUG logging for `ai.genaifund.beyondpilot`.
- A missing database variable stops startup. Spring reports it as `'url' must start with "jdbc"` rather than naming the variable: check `BEYONDPILOT_DATABASE_URL` first.

## Refresh the API contract

After changing a controller, its records or the shared problem schema, regenerate the contract and the web types in the same change ([published API contracts](../conventions.md#published-api-contracts)). Docker must be running; the test starts PostgreSQL through Testcontainers.

```text
BEYONDPILOT_OPENAPI_WRITE=true ./gradlew :backend:test --tests '*OpenApiContractTest'
pnpm --dir web generate:api
```

In PowerShell, set the flag with `$env:BEYONDPILOT_OPENAPI_WRITE='true'` and clear it afterwards. Without the flag, `./gradlew :backend:check` fails when `openapi.yml` is stale, and `pnpm check` fails when `web/src/lib/api/generated` is; the second failure leaves the regenerated files in place to commit.

## Web application

### Prerequisites

- Node.js 24. Verified with 24.19.0.
- pnpm installed directly, not through Corepack. Verified with 11.27.1, the version recorded in `web/package.json`.
- For the browser tests, Chromium for Playwright, installed once with `pnpm --dir web exec playwright install chromium`.

### Run locally

From the repository root:

```text
pnpm --dir web install
pnpm --dir web dev
```

- The application listens on port 3000. English is served at `/`, Vietnamese at `/vi`.
- During development Next.js forwards `/api`, `/login`, `/logout`, `/oauth2` and `/ott` to `BEYONDPILOT_API_ORIGIN`, set to `http://localhost:8080` in the committed `web/.env.development`. Override it in `web/.env.development.local`, which is not committed. A missing value stops the dev server with an explicit error.
- `pnpm --dir web check` runs lint, formatting, type and catalog checks and knip. `pnpm --dir web test:e2e` builds the app, serves it on port 3100 and runs Playwright with axe.

### Windows: SWC native cache permissions

On a Windows machine where other accounts may write into your user profile (for example the `CodexSandboxUsers` group that the Codex sandbox adds), `@swc/core`, loaded by the next-intl plugin, refuses to start and Next.js fails with `ERR_SWC_NATIVE_CACHE` ("DACL grants replacement rights … to SID …"). SWC checks the cache folder and every folder above it, so a folder anywhere under the user profile or at the root of a drive that grants Authenticated Users modify rights does not help. A folder at the root of `C:` with inheritance removed works:

```powershell
$dir = "C:\.swc-native-cache"
New-Item -ItemType Directory -Path $dir -Force | Out-Null
icacls $dir /inheritance:r /grant:r "${env:USERDOMAIN}\${env:USERNAME}:(OI)(CI)F" "NT AUTHORITY\SYSTEM:(OI)(CI)F" "BUILTIN\Administrators:(OI)(CI)F"
[Environment]::SetEnvironmentVariable("SWC_NATIVE_BINDING_CACHE", $dir, "User")
```

Open a new terminal afterwards so the variable is set. Linux CI and containers are not affected.

### Windows: standalone server

The production build uses `output: "standalone"` for containers. On Windows the standalone server cannot follow the symlinks pnpm leaves in `.next/standalone/node_modules` (`EPERM` on `stat`), so `pnpm start` and the Playwright run use `next start`. The standalone server runs in Linux containers (BEY-16).
