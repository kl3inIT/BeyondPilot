# Verification

- The OpenAPI contract-generation test passed with `JAVA_TOOL_OPTIONS=-Duser.timezone=Asia/Ho_Chi_Minh` and `BEYONDPILOT_OPENAPI_WRITE=true`; `openapi.yml` was refreshed. The first attempt used the host's `Asia/Saigon` timezone, which PostgreSQL rejected.
- The generated web client was refreshed with `pnpm --dir web exec node node_modules/@hey-api/openapi-ts/bin/run.js`. The package-script wrapper could not resolve `node` through `cmd.exe` in this environment.
- `git diff --check` passed after the changes.
- `SolutionTest`, `pnpm --dir web check`, end-to-end tests and a browser walk have not been run. The organization filter's database behavior remains to be exercised by the focused integration test before pushing.
