# An organization needs no review: plan

Design: [design.md](design.md). Implementation plan: [implementation-plan.md](implementation-plan.md). Tracked in Linear as BEY-236.

| #   | Step                                                                                                                                                                                                                                                                   | State |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | Research, this design and plan                                                                                                                                                                                                                                         | Done  |
| 2   | GenAI Fund's answers to the three open questions (21 October 2026: yes to all three), recorded in the design                                                                                                                                                           | Done  |
| 3   | `V109__organization_drop_review.sql`: the activation mark, waiting organizations approved and marked, refused ones taken down, the status check narrowed, the three review email templates deleted                                                                     | To do |
| 4   | `organization`: every organization created approved; type changes stay approved; approve, refuse, send back and resubmit removed; the queue counts open claims; the list's `claimed` filter; the remove-owner rule; Javadoc and error words                           | To do |
| 5   | `notification`: the `organization_activated` kind and template; the two review send methods removed; the three review kinds out of the template list. `audit`: the three review actions kept, no longer recorded                                                      | To do |
| 6   | `organization`: `ActivationNotices` emails the owners of each marked organization once and clears the mark                                                                                                                                                              | To do |
| 7   | `solution`, `usecase`, `messaging`, `proposal`: the words of the `NOT_APPROVED` codes and the Javadoc; no change of logic                                                                                                                                              | To do |
| 8   | `mcp`: `decide_record` and `list_pending_reviews` without organizations; `list_records` statuses; the server's instructions and the consent screen in both languages                                                                                                 | To do |
| 9   | `openapi.yml` and the generated web client                                                                                                                                                                                                                             | To do |
| 10  | Figma: Admin home with the Ownership claims cell, Admin › Organizations without review actions and with the new filter, an organization's record without the review panel, My organization without the review banners                                                | To do |
| 11  | Web: Admin home's claims cell; Admin › Organizations' filter and row actions; `organization-review.tsx` removed; the workspace banners and hints; the apply flow, proposal wizard and received-proposal marks; the email kinds; messages in both languages; e2e specs | To do |
| 12  | Documents made true: `ARCHITECTURE.md`; `docs/specs/notification.md`, `proposal.md`, `search.md`, `messaging.md`; `docs/tests/organization.md`, `mcp.md`, `messaging.md`, `notification.md`                                                                          | To do |
| 13  | After the deploy: the activation emails seen in the email log, and the search index rebuilt from Admin, on staging, then production                                                                                                                                    | To do |
| 14  | After production has sent them: a migration drops `activation_notice_pending`, and `ActivationNotices` is removed                                                                                                                                                       | To do |

Steps 3 to 11 land in one pull request: the API change refreshes `openapi.yml` and the web client in the same change, and the web drops what the backend drops.

## Verification

- `./gradlew :backend:check`, against PostgreSQL as the module tests run:
  - a person creates a company, a team and an "other" organization; each is approved at once, invites a member and its members post a use case;
  - a builder on their own who becomes a team, and a team that becomes a company, stay approved;
  - an operator approves a solution of a new organization, and it lists; one of an organization taken down is refused, and restoring the organization lets it list;
  - the queue counts open claims only, now and on each of the last 14 days, and the list's `claimed` filter selects them;
  - the approve, refuse and send-back endpoints are gone from `openapi.yml`; `OpenApiContractTest` passes;
  - the migration on a database holding organizations `in_review`, `needs_changes` and `rejected`: the first two are approved and marked; the refused one is taken down with its reason mapped and its note kept, and is not marked; no other status remains;
  - `ActivationNotices` queues one `organization_activated` email per owner of a marked organization and clears the mark; run again, it queues nothing; an organization without an owner is cleared without an email;
  - the audit log and the email log still name past `organization.approve`, `organization_refused` and `organization_sent_back` entries;
  - MCP: `decide_record` refuses an organization; `list_pending_reviews` lists none.
- `pnpm --dir web check`, and `pnpm --dir web e2e` for the organization and admin home specs: the claims cell opens the claimed filter; Admin › Organizations has no review action; My organization shows no review banner.
- On staging after the deploy: the waiting organizations are active, each owner has one activation email in the email log, the index is rebuilt, and a solution approved earlier under an organization in review shows in the directory.
