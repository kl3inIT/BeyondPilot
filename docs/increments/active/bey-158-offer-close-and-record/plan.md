# An offer is closed to new solutions, and an operator reads its record: plan

Design: [design.md](design.md). Tracked in Linear as BEY-158.

| #   | Step                                                                                                                                                                                                                                             | State |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| 1   | `V85__solution_add_offer_closed_at.sql`: `offer.closed_at`; `Offer.close` and `Offer.reopen`; the read projections carry the state                                                                                                               | To do |
| 2   | `SolutionOffers`: the options leave out a closed offer the solution does not come with; `choose` refuses one; the operators' and an organization's own close and reopen, with `SOLUTION_OFFER_CLOSE` and `SOLUTION_OFFER_REOPEN` in the audit    | To do |
| 3   | The record of an offer for operators: the read of its solutions and `GET /api/solution/admin/offers/{id}`                                                                                                                                        | To do |
| 4   | `PUT …/offers/{id}/closed` on `AdminOffersController` and `SolutionOffersController`; `closed` on the answers of both lists and of the options                                                                                                   | To do |
| 5   | `SolutionTest` cases, the matrix in `docs/tests/solution.md`, `openapi.yml` and the generated web client                                                                                                                                         | To do |
| 6   | Web: the state, its filter and Close/Reopen on `/admin/offers`; the record on `/admin/offers/[id]`; the state and Close/Reopen on My organization › Solutions; a closed offer in the picker; both catalogs                                       | To do |
| 7   | End-to-end tests: cases in `admin-offers.spec.ts` and `workspace-solutions.spec.ts`                                                                                                                                                              | To do |

Run the backend tests with `JAVA_TOOL_OPTIONS=-Duser.timezone=Asia/Ho_Chi_Minh` on a machine whose JVM zone is `Asia/Saigon`: PostgreSQL 18 refuses that name.
