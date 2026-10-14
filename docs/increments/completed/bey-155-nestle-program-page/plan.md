# BEY-155 — plan

Design: [design.md](design.md). Tracked in Linear as BEY-155.

| #   | Step                                                                                                                                                                 | State                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 1   | Web: the written page and its parts, the `boxed` tabs variant, both catalogs, the images, the stub's program and the Playwright test                                 | Done, 12 October 2026 |
| 2   | Documents: the program specification and test matrix                                                                                                                 | Done, 12 October 2026 |
| 3   | Admin: the page kind (written), the days, the application window, the day outcomes are due, the key dates, the info session as an event, the cover and the question  | Open                  |
| 4   | On staging: the page at 1440 and 390 pixels in both languages, an application as a test account; then production and publication; move this increment to `completed` | Open                  |

## Verification

- `pnpm --dir web check` and `pnpm --dir web test:e2e`
- Step 4, which no stub replaces: the real program's dates and its ten use cases on the page.
