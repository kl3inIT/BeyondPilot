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

- Spring Boot Docker Compose support (`spring-boot-docker-compose`, a development-only dependency) starts PostgreSQL and Mailpit from `backend/compose.yaml` and connects the application to the database. No datasource settings are needed.
- Every email the application sends lands in Mailpit: open `http://localhost:8025` to read a sign-in code. Nothing is delivered outside the machine.
- The application listens on port 8080. `http://localhost:8080/actuator/health` returns `"status":"UP"`.
- If the process is killed instead of stopped, the PostgreSQL container keeps running. Remove it with:

  ```text
  docker compose -f backend/compose.yaml down
  ```

- The database is `postgres:18.6` with development-only credentials in `backend/compose.yaml`. Its data lives in the named volume `backend_postgres-data` and survives `down`; `down -v` deletes it.
- On Windows, call the JDK through `JAVA_HOME` when running the jar by hand; a `java` found first on the Git Bash `PATH` may not be JDK 25.

## Profiles and environment variables

Local runs use no profile. Deployed environments run `production`; staging runs `production,staging`.

| Variable                                                                             | Profile      | Purpose                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------ | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BEYONDPILOT_DATABASE_URL`                                                           | `production` | JDBC URL of the PostgreSQL database. No default                                                                                                                                                                |
| `BEYONDPILOT_DATABASE_USERNAME`                                                      | `production` | Database login. No default                                                                                                                                                                                     |
| `BEYONDPILOT_DATABASE_PASSWORD`                                                      | `production` | Database password; a managed secret, never committed. No default                                                                                                                                               |
| `BEYONDPILOT_DATABASE_POOL_SIZE`                                                     | all          | Fixed connection pool size. Default `10`                                                                                                                                                                       |
| `BEYONDPILOT_IDENTITY_OPERATOR_EMAILS`                                               | all          | Comma-separated addresses that become operators when they sign in. Default: none                                                                                                                               |
| `BEYONDPILOT_IDENTITY_GOOGLE_CLIENT_ID`, `BEYONDPILOT_IDENTITY_GOOGLE_CLIENT_SECRET` | all          | Google OAuth client. Locally Google sign-in is off without them; `production` does not start without them. The secret is a managed secret, never committed                                                     |
| `BEYONDPILOT_MAIL_HOST`, `BEYONDPILOT_MAIL_PORT`                                     | all          | SMTP server. Default `localhost:1025`, the Mailpit container; no default under `production`                                                                                                                    |
| `BEYONDPILOT_MAIL_USERNAME`, `BEYONDPILOT_MAIL_PASSWORD`                             | `production` | SMTP login; the password is a managed secret, never committed. No default                                                                                                                                      |
| `BEYONDPILOT_MAIL_FROM`                                                              | all          | Sender of every email. Default a `beyondpilot.localhost` address; no default under `production`                                                                                                                |
| `BEYONDPILOT_STORAGE_PROVIDER`                                                       | all          | Where uploaded files are kept: `local` (a directory) or `s3` (a bucket the browser uploads to directly). Default `local`; no default under `production`                                                        |
| `BEYONDPILOT_STORAGE_LOCAL_DIRECTORY`                                                | all          | The directory of the local store. Default `build/storage` under `backend/`, which Git ignores. A deployed environment that uses the local store puts it on a volume                                            |
| `BEYONDPILOT_STORAGE_S3_BUCKET`, `BEYONDPILOT_STORAGE_S3_REGION`                     | all          | The bucket of the S3 store and its region. Required when the provider is `s3`. Credentials come from the AWS SDK's default chain (the role of the instance or task), never from a variable of this application |
| `BEYONDPILOT_STORAGE_S3_ENDPOINT`                                                    | all          | Another S3-compatible endpoint, addressed by path; only for running against MinIO. Default: none                                                                                                               |

- `production` writes Logstash-format JSON logs to standard output; `staging` adds DEBUG logging for `ai.genaifund.beyondpilot`.
- A missing database variable stops startup. Spring reports it as `'url' must start with "jdbc"` rather than naming the variable: check `BEYONDPILOT_DATABASE_URL` first.

## Sign in locally

1. Start the backend and the web application.
2. Ask for a code at `http://localhost:3000/sign-in`.
3. Open `http://localhost:8025` (Mailpit), read the six digits in the newest email and type them into the waiting screen.

To sign in as an operator, put your address in `BEYONDPILOT_IDENTITY_OPERATOR_EMAILS` in the local `.env` file described below.

`./gradlew :backend:bootRun` reads `.env` at the repository root when the file exists: one `NAME=value` per line, `#` for comments. Git ignores the file; `.env.example` lists the names it may hold. Only the `bootRun` task reads it, so tests and deployed environments are not affected. Each checkout and worktree has its own `.env`.

Google sign-in works locally once a Google OAuth client exists whose redirect URI is `http://localhost:3000/login/oauth2/code/google`. Keep its id and secret in `.env` as `BEYONDPILOT_IDENTITY_GOOGLE_CLIENT_ID` and `BEYONDPILOT_IDENTITY_GOOGLE_CLIENT_SECRET`. The values never go on a command line, into a tracked file or into a message. A client for a deployed environment is a separate client, managed with that environment's secrets. The same flow by hand needs one cookie jar for both requests, because the code works only in the session that asked for it: `curl -c jar.txt -X POST -H "X-BeyondPilot-CSRF: 1" --data-urlencode "username=you@example.test" http://localhost:8080/ott/generate`, then `curl -b jar.txt -c jar.txt -X POST -H "X-BeyondPilot-CSRF: 1" -d "code=<code>" http://localhost:8080/login/ott`.

## Uploaded files

Locally files go to `backend/build/storage`; nothing else is needed. An upload is three requests: `POST /api/storage/uploads` reserves it and answers with a ticket, the browser sends the bytes to the ticket's address with the ticket's headers, and `POST /api/storage/uploads/{id}/confirm` makes the file usable ([storage increment](../increments/active/bey-32-storage/design.md)).

To run the S3 store without AWS, start a MinIO container, create a bucket in it, and set `BEYONDPILOT_STORAGE_PROVIDER=s3`, the bucket, a region such as `us-east-1`, `BEYONDPILOT_STORAGE_S3_ENDPOINT=http://localhost:9000`, and MinIO's user and password as `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in the local `.env`. `S3StorageTest` does the same in a container on every run.

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
