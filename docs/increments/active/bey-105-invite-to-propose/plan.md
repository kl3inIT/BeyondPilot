# BEY-105 — plan

Design: [design.md](design.md). Tracked in Linear as BEY-105. Steps 2 to 5 share one branch and one pull request.

| #   | Step                                                                                                                                                                | State                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1   | This design and plan; Đạt's approval of the decisions, the new dependency of `matching` on `notification` among them                                                | Done, 14 October 2026 ("code đi") |
| 2   | Backend: the migration, `invite`, the recipients from `organization`, the email kind and its template, the audit action, `openapi.yml`, the generated client; tests | Open                              |
| 3   | Web: Invite to propose on the card, the panel and the row; the dialog; Invited and Proposal received; both catalogs                                                 | Open                              |
| 4   | End-to-end tests; `docs/tests/matching.md`                                                                                                                          | Open                              |
| 5   | Staging: invite with the email going to the staging mailbox; check the email and the states                                                                         | Open                              |
| 6   | Production: the first invitation is sent by a person of GenAI Fund's choosing                                                                                       | Open                              |

## Verification

- Backend over HTTP: a member invites once and the second time is refused; a removed candidate, a closed use case and a provider with no one to email are refused; the limit holds for members and not for operators; the email goes to the owners, or to the open invitations to own when there is no owner; the audit record names the provider.
- In a browser: the dialog names who is emailed; the card reads Invited after sending, and Proposal received once the provider has sent one.
