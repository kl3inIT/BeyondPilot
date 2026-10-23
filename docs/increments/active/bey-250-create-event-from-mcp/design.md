# Operator MCP: create an event, on Luma with its BeyondPilot page, or on BeyondPilot alone

Status: proposed to Đạt on 23 October 2026; built the same day. Tracked in Linear as BEY-250. What was read before this design is in [MCP write tools](../../../research/2026-10-20-mcp-write-tools.md) and [Luma registration](../../../research/2026-10-23-luma-registration.md).

## Why

Kai Yong, 23 October 2026: "We want to be able to use mcp to create an event page on BeyondPilot that's linked to Luma MCP… our own form but it's linked to Luma." Since [BEY-245](../bey-245-luma-registration/design.md), an event on GenAI Fund's Luma calendar gets a BeyondPilot page with BeyondPilot's own registration form, but the event itself is still made on Luma. Đạt read Kai's message as BeyondPilot's own MCP server and agreed, on 23 October, to one tool that makes either kind of event: one on Luma with its BeyondPilot page, or one on BeyondPilot alone.

## What an operator can do

From ChatGPT, Claude or another app connected to `/mcp/operator`, as the operator signed in to it, say "create an event: TinyFish, Big Minds, 30 October 18:30 to 21:00 in Ho Chi Minh City at BỜM, approval required, 40 seats, ask their company and LinkedIn". The app asks before the call, as for every write tool. Then:

- **On Luma (the default).** The event is created on the connected Luma calendar as a private event, and its BeyondPilot page is made at once as a draft program of type event, with the registration form built from the questions given. The answer gives the BeyondPilot admin page, the BeyondPilot page and the Luma page.
- **On BeyondPilot alone.** A draft program of type event is made as Admin › Programs › New makes it, with the event's date and place, and an outside registration link if one is given. It has no registration form, which needs Luma.

Either way nothing is public and nobody is told until an operator publishes: the program in Admin › Programs, and for a Luma event its visibility on Luma.

## The tool

| Tool           | Arguments                                                                                                                                                                                                                                                                                                                                                                                                         | Calls                                                                                                                                                                             | `destructiveHint` |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `create_event` | `on_luma` (true by default), `name`, `starts_at`, `ends_at`, `timezone` (IANA), `venue` (a free-text address) or `meeting_url`, `city`, `country`, `description` (Markdown), `summary`; for Luma only: `require_approval`, `capacity`, `waitlist`, `hide_venue_until_approved`, `questions` (each `label`, `type` of `text`, `long_text`, `select`, `multi_select`, `url`, `linkedin`, `agree`, `company`, `required`, `options`); for BeyondPilot alone: `registration_url` | Luma: `LumaApi.createEvent`, then the calendar read of that one event; BeyondPilot alone: `ProgramAdministration.create` then `save`, as the admin screen does | false             |

`readOnlyHint: false`, `openWorldHint: true` for the Luma path, since it writes to Luma, `idempotentHint: false`: a second call makes a second event.

## Decisions

1. **One tool, Luma by default.** Đạt chose one tool for both kinds on 23 October. Two tools would split one request ("create an event") on a detail the operator may not have in mind; `on_luma` says it, and the description says when to pass false: an event GenAI Fund does not run on Luma, such as a partner's.
2. **Private and draft, always.** The Luma event is created `private` and the program as a draft, so nothing is public or emailed before an operator looks at it. Calendar subscribers are not told of a private event. This keeps `destructiveHint: false` honest: nobody has been told, and the outcome waits for an operator: BeyondPilot deletes no program, so a draft nobody publishes stays seen by operators alone, and the Luma event is deleted on Luma.
3. **The BeyondPilot page at once, through the calendar read.** After `events/create` answers the event's id, the tool reads that one event as the calendar read does, which makes the draft program with its form, cover and dates. The calendar read already turns a private Luma event into a draft, and it never changes the status of a program it holds, so the hourly read and the webhook do not undo what the tool made. A second path that writes programs from the tool's arguments would drift from what Luma holds.
4. **Questions in Luma's own form.** The tool takes the question types BeyondPilot's form renders and maps them to Luma's (`text` with `multiline`, `select` with `multiple`, `url`, `linkedin`, `agree-check`, `company`); Luma keeps them, and the form is built from what Luma answers, as for an event made on Luma. Social-handle, phone and terms questions are made on Luma.
5. **Free events only.** The event is created with one free ticket type that carries `require_approval`, as the test event was. A paid event keeps its Luma page (BEY-245), so it is made on Luma.
6. **Staging writes only test events.** Staging's key reaches GenAI Fund's real calendar. There the tool always names the event `[TEST] <name>`, keeps it private, and the event's registrations are allowed alongside the configured test event, so Kai can try the whole flow. The prefix is configuration (`beyondpilot.program.luma.created-name-prefix`), empty by default and in production.
7. **Audited and logged.** The call log keeps the call. An event on Luma is audited as `program.luma_event_create` with Luma's id of the event in `event`, on the program, or on the event while the calendar read has not brought it; the program the read makes is the read's, as for any Luma event. An event on BeyondPilot alone is audited as `program.create` and `program.update`, as on the admin screen. Luma is called outside any transaction; only the audit record is written in one, so a slow Luma holds no database connection.
8. **What stays on Luma and in Admin.** Changing, cancelling or deleting the event, uploading a cover, and making it public stay on Luma; publishing the program stays in Admin › Programs. A later tool can publish once Kai has used this one.

## Out of scope

Updating or cancelling an event, covers, paid tickets, Zoom or Meet links made by Luma (`create_meeting`), publishing from the MCP, events on another host's calendar.
