# Operator MCP write tools: plan

Design: [design.md](design.md). Tracked in Linear as BEY-232.

| #   | Step                                                                                                                                                       | State |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | Research, this design and plan                                                                                                                             | Done  |
| 2   | What "private" means: the real company, seen only by operators until published (Đạt, 20 October)                                                           | Done  |
| 3   | `usecase`: a private draft its members do not see; an operator saves and publishes it, audited                                                             | Done  |
| 4   | `mcp`: `decide_record`, `decide_application`, `decide_proposal`, with annotations, descriptions, answers before and after, errors as tool errors, switches | Done  |
| 5   | `mcp`: `create_organization`, `create_use_case`, `update_use_case`, `publish_use_case`, `send_back_use_case`                                               | Done  |
| 6   | The consent screen and the server's instructions say what the app may change, in both languages                                                            | Done  |
| 7   | Documents made true: `ARCHITECTURE.md`, `docs/tests/mcp.md`                                                                                                | Done  |

Step 4 does not wait for Kai's answer and can ship first. Each step is one or more commits on one branch with one pull request.

## Verification

- `./gradlew :backend:check`, the tools called over MCP against PostgreSQL as the existing operator tool tests do:
  - an operator approves an organization in review and sends one back; the organization's state, the audit record and the email are those of the admin screen; approving it again is a tool error with the service's code;
  - a member who is not an operator is refused every write tool;
  - each write tool lists `readOnlyHint: false` and the `destructiveHint` of the design; a tool switched off is not listed;
  - an application is shortlisted alone, and refused after the outcomes are released;
  - a use case created private is not public, is changed, then published.
- `pnpm --dir web check` for the consent screen's words.
- On staging: Kai's flows from ChatGPT in Developer mode and from Claude, each write asked before it runs.
