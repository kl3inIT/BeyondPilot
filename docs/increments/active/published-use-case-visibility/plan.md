# Implementation plan

- [x] Include expired published use cases in directory, detail and search without exposing drafts.
- [x] Add proposal-status filtering and deterministic paged ordering with shared count predicates.
- [x] Update card and proposal-panel status/deadline wording in English and Vietnamese.
- [x] Extend repository, HTTP and browser coverage, including pagination and blocked late submissions.
- [x] Refresh the API contract/client and record verification and gate limitations.
- [x] Implement the accepted Figma availability layout: status beside the list deadline/action and a disabled red expiry control in the detail panel, preserving existing-proposal links.

## Verification

### Figma availability refinement, 16 October

- The frontend gate's checks passed: API drift, lint, formatting, TypeScript, 732 unit/component tests across 85 files, message/error catalogs and knip. The API drift step briefly invalidated the running webpack compiler while replacing generated files; restarting only this checkout's web process restored the real-API preview. No application workaround was added.
- Eight added component tests cover the expired guest/new/draft/withdrawn/refused paths, existing sent/received view actions and the no-deadline sending path. The focused proposal suite passed all 20 tests.
- Real-API browser smoke passed at 1440, 1024 and 390 pixels: card status position below the facts and aligned with the deadline, availability filtering and page link, closed brief/readable neutral status, visible full-opacity disabled danger control, English/Vietnamese text, unchanged open submission link, no horizontal overflow/page errors, and no serious/critical axe violations on the expired detail. Desktop and mobile screenshots were inspected. The production-build fixture E2E suite was not run for this visual refinement.

### Initial published-visibility implementation

- Regenerated OpenAPI and the web SDK together. The frontend gate passed, including 724 tests; a final formatting check covers the subsequent browser-test locator corrections.
- The full backend run executed 520 tests; two expectations needed updates for the changed availability contract and the unchanged operator transition guard. After those fixture updates, all 33 tests in SearchDirectoriesTest, SearchMeaningTest and UseCaseAdministrationTest passed together. No submission guard or database constraint was weakened. The entire backend gate was not rerun after the test-only corrections, so a fully green backend gate is not claimed.
- A separate local application runs against its own Testcontainers PostgreSQL database at API port 8080; Next.js at port 3000 reads that API, not browser fixtures. The ignored seed creates 14 published briefs (6 open, 8 closed) and 3 expired private records (draft, in review, needs changes).
- Real HTTP reads verified totals, 10+4 pagination, both availability filters, closed detail readability, private detail 404 and closed-only search pagination.
- Playwright smoke against the real API passed on 1440px desktop and 390px mobile: list totals, next-page address, filter interaction and URL update, closed detail/no submission link, Vietnamese wording, no page errors and no horizontal overflow. Screenshots were inspected.
- The committed fixture-browser cases were extended but their full production-build E2E suite was not run during the local-preview handoff.
