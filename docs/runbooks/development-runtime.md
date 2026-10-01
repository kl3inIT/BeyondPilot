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

The PostgreSQL image is `postgres:latest` with development-only credentials in `backend/compose.yaml`; pinning the image version is open in BEY-14.

## Environment variables

None yet. The application runs on its generated defaults; `BEYONDPILOT_*` variables arrive with the `development`, `staging` and `production` profiles (BEY-14).
