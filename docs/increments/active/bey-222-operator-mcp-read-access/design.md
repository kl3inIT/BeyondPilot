# Operator MCP: read-only access to what /admin shows

Tracked in Linear as BEY-222. Asked by GenAI Fund (Kai, 18 October 2026): read-only access through MCP to everything an operator sees in /admin, across all programs, limited to operators, every read logged.

## What it does

The operators' server, `/mcp/operator` (scope `mcp.research`, operators only), gains read-only tools over what the admin screens read. Each tool calls the application service its admin screen calls, with the caller as the actor, so the operator role is checked again there.

| Area                       | Tools                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Applications               | `list_applications` (status, challenge area, drafts), `get_application` (submitted or draft, `detail`), `read_application_file` |
| Programs                   | `list_programs`, `get_program` (settings, window, questions, criteria, judges, outcome status)                                  |
| Review queues              | `list_records(area, status, q)`, `get_record(area, id, detail)` with history; `list_pending_reviews`                            |
| Accounts, audit, email, AI | `list_accounts`, `list_audit_events`, `list_emails`, `get_email`, `list_matching_runs`, `get_matching_run`, `get_matches`       |
| Search                     | `search` finds a record by its name before others that share its words, on both servers                                         |

Admin › AI › MCP › Activity shows the record each call read, linked to its admin page, under the calls, refused and failed counts of the period.

## Decisions

| Decision                                                                                                                                                   | Why                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No dynamic client registration                                                                                                                             | MCP 2026-07-28 deprecates it in favour of client ID metadata documents; BEY-78 decided the same. The apps in use connect without it (Claude, ChatGPT, Codex, VS Code, Zed, Goose, Cursor, Grok Bot, `mcp-local`) |
| A read is logged in `mcp_call`, not in the audit log: the record's kind, id, its name when read and its admin page                                         | The call log already holds every call by person and app; the record read answers "who read what" and links to it. Never the arguments or the answer                                                              |
| Tools of one shape across areas are one pair with an `area` argument (`list_records`, `get_record`)                                                        | As GitHub's MCP server does for Actions (`actions_list`, `actions_get`); fewer tools for an AI to choose between, which Anthropic's tool guidance favours                                                        |
| A heavy read answers concisely unless `detail: true` (answers and judges' notes, an email's HTML, matching findings with quotes, a run's steps)            | Saves the AI app's context when reading many records; `response_format` in Anthropic's guidance                                                                                                                  |
| An email is read with its text body; HTML only with `detail`; a sign-in code's subject and body never leave, and a search finds a code only by its address | Operators read the same in Admin › Email. A sign-in code signs in for 15 minutes, so it is withheld, and searching its digits finds nothing                                                                      |
| Review history comes from the audit log                                                                                                                    | Records keep only their latest decision; every decision is audited                                                                                                                                               |
| Search: same ranking for both servers, each kind's best side by side, an exact or whole-name title first                                                   | The MCP search listed up to twelve solutions before any program; kinds' fusion scores do not compare, so they are interleaved by place                                                                           |

## Modules

`mcp` gains dependencies on `notification` (email activity) and `matching` (runs and results), for reads through their published services; neither depends on `mcp`. `audit` gains a read of one resource's events for review history and a cursor read of the log. Each module that owns a read publishes a record in its root package for `mcp` to use, since `dto` packages are internal.

## Out of scope

Write tools; dynamic client registration; the audit log as the record of MCP reads.
