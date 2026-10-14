# BEY-128 — plan

Design: [design.md](design.md). Tracked in Linear as BEY-128.

| #   | Step                                                                                                                                                                                              | State                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 1   | Brevo's documentation read, and the SDK proved on the build's OkHttp                                                                                                                              | Done, 11 October 2026 |
| 2   | Backend: `V73__notification_add_brevo.sql`, `EmailProvider.BREVO`, `BrevoEmailAdapter` (send and setup checks), the API key and the webhook token in the settings, the report endpoint and intake | Done, 11 October 2026 |
| 3   | Contract: `openapi.yml` and the generated web client                                                                                                                                              | Done, 11 October 2026 |
| 4   | Web: Brevo in the settings form and the setup checklist, both catalogs, the stub and the Playwright spec                                                                                          | Done, 11 October 2026 |
| 5   | Documents: the specification, the test matrix, `ARCHITECTURE.md`, the roadmap                                                                                                                     | Done, 11 October 2026 |
| 6   | On staging with a Brevo account: save the key, read the checklist, send a test, set the webhook with its token, and find a delivered and a bounced email in Activity                              | Open                  |
| 7   | Settle what step 6 shows of the [points not verified](design.md#not-verified), then move this increment to `completed`                                                                            | Open                  |

## Verification

- `./gradlew :backend:check`
- `pnpm --dir web check` and `pnpm --dir web test:e2e`
- Step 6, which no test replaces: a mock never establishes a live integration.
