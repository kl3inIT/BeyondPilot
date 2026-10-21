# An organization needs no review: plan

Design: [design.md](design.md). Tracked in Linear as BEY-236.

| #   | Step                                                                                                                                                                                                                                                                                                 | State |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | Research, this design and plan                                                                                                                                                                                                                                                                       | Done  |
| 2   | GenAI Fund's answers to the three questions of the design                                                                                                                                                                                                                                            | To do |
| 3   | Figma: Admin home without the Organizations cell, Admin › Organizations without review actions and with the new filter, an organization's record without the review panel, My organization without the review banners                                                                               | To do |
| 4   | `V109__organization_drop_review.sql`: waiting organizations approved, refused ones taken down, the status check narrowed, the three email templates deleted                                                                                                                                         | To do |
| 5   | `organization`: every organization created approved; type changes stay approved; approve, refuse, send back, resubmit, the queue and its by-day count removed; the list's filter and order; the remove-owner rule; Javadoc and error words                                                          | To do |
| 6   | `notification` and `audit`: the two send methods removed, the three email kinds out of the template list, the three audit actions kept and no longer recorded                                                                                                                                        | To do |
| 7   | `solution`, `usecase`, `messaging`, `proposal`: the words of the `NOT_APPROVED` codes and the Javadoc; no change of logic                                                                                                                                                                             | To do |
| 8   | `mcp`: `decide_record` and `list_pending_reviews` without organizations; `list_records` statuses; the server's instructions and the consent screen in both languages                                                                                                                               | To do |
| 9   | Tests: `OrganizationTest`, `SolutionTest`, the MCP operator tool tests, `ModulithArchitectureTest` unchanged; `openapi.yml` and the generated web client                                                                                                                                            | To do |
| 10  | Web: Admin home's strip; Admin › Organizations' filter and row actions; `organization-review.tsx` removed; the workspace banners and hints; the apply flow, proposal wizard and received-proposal marks; the email kinds list; messages in both languages                                         | To do |
| 11  | End-to-end tests: `workspace-organization.spec.ts` and the admin organization specs                                                                                                                                                                                                                  | To do |
| 12  | Documents made true: `ARCHITECTURE.md`; `docs/specs/notification.md`, `docs/specs/proposal.md`, `docs/specs/search.md`, `docs/specs/messaging.md`; `docs/tests/organization.md`, `docs/tests/mcp.md`, `docs/tests/messaging.md`, `docs/tests/notification.md`                                      | To do |
| 13  | After the deploy: the search index rebuilt from Admin on staging, then production                                                                                                                                                                                                                    | To do |

Steps 4 to 9 land with step 10 in one pull request: the API change refreshes `openapi.yml` and the web client in the same change.

## Verification

- `./gradlew :backend:check`, against PostgreSQL as the module tests run:
  - a person creates a company, a team and an "other" organization; each is approved at once, invites a member and its members post a use case;
  - a builder on their own who becomes a team, and a team that becomes a company, stay approved;
  - an operator approves a solution of a new organization, and it lists; one of an organization taken down is refused, and restoring the organization lets it list;
  - the approve, refuse, send-back and queue endpoints are gone from `openapi.yml`; `OpenApiContractTest` passes;
  - the migration on a database holding organizations `in_review`, `needs_changes` and `rejected`: the first two are approved; the refused one is taken down with its reason mapped and its note kept; no other status remains;
  - the audit log and the email log still name past `organization.approve`, `organization_refused` and `organization_sent_back` entries;
  - MCP: `decide_record` refuses an organization; `list_pending_reviews` lists none.
- `pnpm --dir web check`, and `pnpm --dir web e2e` for the organization specs: Admin home has four cells; Admin › Organizations has no review action; My organization shows no review banner.
- On staging after the deploy: the waiting organizations are active, the index rebuilt, and a solution approved earlier under an organization in review shows in the directory.
