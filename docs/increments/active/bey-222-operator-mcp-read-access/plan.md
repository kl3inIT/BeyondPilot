# Operator MCP: read-only access to what /admin shows: plan

Design: [design.md](design.md). Tracked in Linear as BEY-222.

| #   | Step                                                                                                  | State |
| --- | ----------------------------------------------------------------------------------------------------- | ----- |
| 0   | Research (existing reads, MCP tool design at GitHub, Linear and Anthropic), decisions agreed with Đạt | Done  |
| 1   | `mcp_call` keeps the record a call read; Activity's Read column and counts                            | Done  |
| 2   | Search ranks a record named by the query first, each kind's best side by side                         | Done  |
| 3   | Applications and programs tools                                                                       | Done  |
| 4   | Review records tools with history                                                                     | Done  |
| 5   | Accounts, audit, email and matching tools                                                             | Done  |
| 6   | Staging, Kai tries it, production on request                                                          | To do |

## Verification

Each tool is tested through a real MCP client with an operator's OAuth connection, as `McpServerTest` does; a call's log row carries the record read. `SearchTest` holds the program-before-solutions order.
