# Program: plan

Design: [design.md](design.md). Tracked in Linear as BEY-29.

| #   | Step                                                                                                                                                                                                          | State                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| 1   | Backend: `V4__program_create_programs.sql`; the `program` module, closed, depending on `identity` and `audit`, listed in `ModulithArchitectureTest`; an operator creates a draft, reads it and reads the list | Done                       |
| 2   | Backend: the save of a program with its window, key dates, events and cover, with its rules and its audit event                                                                                               | Done                       |
| 2b  | Backend: publish and unpublish, with what still blocks publishing                                                                                                                                             | Done                       |
| 3   | Backend: the public list and the public program, with the phase worked out from the dates; `openapi.yml` and the generated web client refreshed                                                               | Done                       |
| 4   | Web: the upload helper (reserve, send, confirm), then the admin Programs list and a program's Settings (BEY-55)                                                                                               | Done                       |
| 5   | Web: the public programs list (BEY-58)                                                                                                                                                                        | Done                       |
| 6   | Web: the standard program page, then the page made for the AI for Insurance Challenge (BEY-58). Its Apply leads to the interim form until the application flow exists (BEY-37)                                | Done                       |
| 7   | Documents made true: `docs/tests/program.md` and `ARCHITECTURE.md` with the backend; the roadmap and the domain model's table with the pages                                                                  | Backend part done          |
| 8   | The real programs entered through the admin screen on the first environment: the Tasco challenge, its briefing, the monthly meetup and the programs of 2026                                                   | After the first deployment |

Each step is one or two commits, pushed as it is finished. The work is three branches with one pull request each, so that each can be read alone: this design with the backend (steps 1 to 3), the admin screens (step 4), the public pages (steps 5 and 6). Step 7 is spread over them: each pull request makes true the documents its own change touches.

After this increment, in their own: free sections with their editor, judges and partners with logos, the ended program with results, the Overview and Reviewers tabs.

## Verification

- `./gradlew :backend:check`. The program tests start the application against PostgreSQL and speak HTTP:
  - an operator creates, saves, publishes and unpublishes; a caller who is not an operator is refused; each change leaves an audit event;
  - a taken or malformed address, a window that closes before it opens, outcomes due before the window closes, publishing while a summary, a cover or the days are missing, and a save over someone else's save are refused, each naming its field or its reason;
  - the public list shows published programs only, and a program's phase changes with the clock at each boundary: before the window, inside it, after it, after the last day;
  - a draft answers `404` at its public address.
- `pnpm --dir web check` and `pnpm --dir web test:e2e`: the list in each phase, the standard page, the Tasco page with dates taken from the API, the admin list and Settings with a save and a refused save, at desktop and mobile widths, with axe.
- By hand on the local stack: a program created, a cover uploaded and shown on the public list, the program published and opened in both languages.

## Needed from outside the code

| What                                                                                   | For                                                      | Where it is managed                                                                                                    |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| The cover images of the programs                                                       | The list and the pages                                   | Uploaded by an operator; the sources of those already collected are in `docs/research/data/landing-image-sources.json` |
| Confirmation of the Tasco challenge's dates and of which set of challenge areas stands | The page made for it, and step 3 of the application form | Asked in BEY-41                                                                                                        |
