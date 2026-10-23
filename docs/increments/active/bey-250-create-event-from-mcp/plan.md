# Create an event from the MCP: plan

Design: [design.md](design.md). Tracked in Linear as BEY-250.

| #   | Step                                                                                                                                                     | State       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | Research, this design and plan                                                                                                                           | Done        |
| 2   | `program`: `LumaApi.createEvent`, the calendar read of one event, the staging prefix and the registrations it allows                                     | Done        |
| 3   | `mcp`: `create_event` with its annotations, description and answers, its switch; BeyondPilot alone through `ProgramAdministration`                       | Done        |
| 4   | Documents made true: `docs/specs/program.md`, `docs/specs/mcp.md` if present, `docs/tests/mcp.md`, `docs/tests/program.md`, the server's instructions | Done        |
| 5   | On staging: a `[TEST]` event made from Claude, its page and form read, one registration sent                                                            | Blocked     |

One branch with one pull request.

## Verification

- `./gradlew :backend:check`, the tool called over MCP against PostgreSQL with a stub Luma, as `EventRegistrationTest` does:
  - on Luma: `events/create` receives a private event, one free ticket with the approval asked and the questions in Luma's form; a draft program of type event exists with its form; the answer gives its pages;
  - on BeyondPilot alone: a draft program of type event with its date, place and registration link, and no call to Luma;
  - with the staging prefix set, the name sent to Luma starts with it;
  - a member who is not an operator is refused; no Luma connection is a tool error that says so; a refusal by Luma is a tool error with Luma's reason.
- On staging, step 5.

## Staging, 23 October 2026

- The operators' server lists `create_event` with its schema and annotations.
- On BeyondPilot alone: `[TEST] Partner night (BEY-250 check)` was made as a draft program of type event with its days,
  summary and address; the admin page shows it with only the cover missing. BeyondPilot deletes no program, so it stays
  as a draft only operators see; the tool's description had said an operator deletes it, which was corrected.
- On Luma: blocked. Staging has no Luma calendar connected (Admin › Programs › Luma is empty, and the audit log has no
  connection), so the call answers `PROGRAM_LUMA_NOT_CONFIGURED`. Connecting needs the GenAI Fund calendar's API key.
