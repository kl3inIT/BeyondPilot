# Verification

- The OpenAPI contract-generation test passed with `JAVA_TOOL_OPTIONS=-Duser.timezone=Asia/Ho_Chi_Minh` and `BEYONDPILOT_OPENAPI_WRITE=true`; `openapi.yml` was refreshed. The first attempt used the host's `Asia/Saigon` timezone, which PostgreSQL rejected.
- The generated web client was refreshed with `node node_modules/@hey-api/openapi-ts/bin/run.js` from `web/`. The merge's generated `index.ts` still contained conflict markers because invoking `dist/index.mjs` did not run the generator. The CLI regenerated it, and `check:api` passed.
- `git diff --check` passed after the changes.
- After merging main, the organization filter and featured filter are retained together. The callers now use `organizationId`, and the integration assertion includes the second solution whose name also matches the search.
- Local web checks passed generated-client drift, ESLint, Prettier, TypeScript, message catalogs and knip. Unit tests passed 139 of 140 cases; the unrelated PDF.js deck-reading test timed out on Windows twice without changing its timeout or assertions. The full backend gate and focused admin-solutions browser suite are being exercised; CI results on PR #204 are the authoritative full-run evidence.
