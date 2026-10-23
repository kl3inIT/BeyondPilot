# Create an event from the MCP: plan

Design: [design.md](design.md). Tracked in Linear as BEY-250.

| #   | Step                                                                                                                                                     | State       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | Research, this design and plan                                                                                                                           | Done        |
| 2   | `program`: `LumaApi.createEvent`, the calendar read of one event, the staging prefix and the registrations it allows                                     | Done        |
| 3   | `mcp`: `create_event` with its annotations, description and answers, its switch; BeyondPilot alone through `ProgramAdministration`                       | Done        |
| 4   | Documents made true: `docs/specs/program.md`, `docs/specs/mcp.md` if present, `docs/tests/mcp.md`, `docs/tests/program.md`, the server's instructions | Done        |
| 5   | On staging: a `[TEST]` event made from Claude, its page and form read, one registration sent                                                            | Not started |

One branch with one pull request.

## Verification

- `./gradlew :backend:check`, the tool called over MCP against PostgreSQL with a stub Luma, as `EventRegistrationTest` does:
  - on Luma: `events/create` receives a private event, one free ticket with the approval asked and the questions in Luma's form; a draft program of type event exists with its form; the answer gives its pages;
  - on BeyondPilot alone: a draft program of type event with its date, place and registration link, and no call to Luma;
  - with the staging prefix set, the name sent to Luma starts with it;
  - a member who is not an operator is refused; no Luma connection is a tool error that says so; a refusal by Luma is a tool error with Luma's reason.
- On staging, step 5.
