# A solution comes with offers: plan

Design: [design.md](design.md). Tracked in Linear as BEY-148.

| #   | Step                                                                                                                                                                                                                                                                                       | State |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| 1   | `V83__solution_create_offers.sql`: `offer` and `solution_offer`; the `Offer` entity, its repository and the read projections; the solution holds the offers it comes with                                                                                                                  | Done  |
| 2   | `SolutionOffers`: the offers a solution may choose, the operators' create, save and delete, and an organization's own create, list, save and delete, with their audit actions; `AdminOffersController` and `SolutionOffersController`                                                      | Done  |
| 3   | A save names the offers (`SaveSolution.offerIds`); an operator chooses them on a submitted solution (`PUT /api/solution/admin/solutions/{id}/offers`); the editor's, the directory's and the page's answers carry them                                                                     | Done  |
| 4   | The search index carries the offers: `IndexedSolution.offers`, the row's facets and text, `SearchItem.offers`; a change to an offer writes again the cards of the solutions that come with it                                                                                              | Done  |
| 5   | `SolutionTest` and `SearchDirectoriesTest` cases, the matrices in `docs/tests/solution.md` and `docs/tests/search.md`, `openapi.yml` and the generated web client                                                                                                                          | Done  |
| 6   | Web: the gift, the line and the panel of offers on the card and the page; the picker in the editor's first step and on the operators' record of a solution; `/admin/offers` with its dialog and its sidebar entry; the organization's offers on My organization › Solutions; both catalogs | Done  |
| 7   | End-to-end tests: `admin-offers.spec.ts`, and cases in `solutions.spec.ts` and `workspace-solutions.spec.ts`                                                                                                                                                                               | Done  |

Run the backend tests with `JAVA_TOOL_OPTIONS=-Duser.timezone=Asia/Ho_Chi_Minh` on a machine whose JVM zone is `Asia/Saigon`: PostgreSQL 18 refuses that name.
