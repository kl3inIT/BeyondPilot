# BEY-190 — plan

Design: [design.md](design.md). Tracked in Linear as BEY-190, under BEY-183. Steps 2 to 5 share one branch and one pull request.

| #   | Step                                                                                                                                                                | State                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 1   | This design and plan; Đạt's approval: iCal and JSON-LD rather than the API, Luma overwrites edits, the landing's card reads the events (14 October)                 | Done, 14 October 2026 |
| 2   | Backend, `storage`: a file the server keeps; tests                                                                                                                  | Done, 14 October 2026 |
| 3   | Backend, `program`: the migration, the job, the two reads, the HTTP client; tests against a stub Luma                                                               | Done, 14 October 2026 |
| 4   | Web: the events card reads the next two events; both catalogs; the stub and the Playwright spec                                                                     | Done, 14 October 2026 |
| 5   | Documents: `docs/specs/program.md`, `docs/specs/storage.md`, `docs/tests/program.md`, the roadmap                                                                   | Done, 14 October 2026 |
| 6   | Staging: within the hour TinyFish, Big Minds is on Programs and events and on the home page with its cover; unpublish it in Admin and see it stay unpublished       | Open                  |
| 7   | Production: an operator enters the Tasco demo day of 22 October as an event of `insurance-ai-tasco` before the release; after it, both events show on the home page | Open                  |

## Verification

- `./gradlew :backend:check`: a future event is created published with its cover, days and event; a second read changes nothing; a change on Luma updates the program; an unpublished program stays so; an event gone from the feed is unpublished; a failed feed changes nothing; a past event is not read; an address that is taken gets a suffix; a host not configured is not called.
- `pnpm --dir web check` and the home page's Playwright spec: the two events of the stub, soonest first, linked to their registration.
- Step 6, which no stub replaces: the real feed and page.
