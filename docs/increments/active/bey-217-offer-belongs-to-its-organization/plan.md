# An offer belongs to the organization that gives it: plan

Design: [design.md](design.md). Tracked in Linear as BEY-217.

| #   | Step                                                                                                                                                                                                                     | State |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| 1   | `V102__solution_offer_belongs_to_its_organization.sql`: `offer.from_genai_fund`, the old list given to the organizations that use it, `organization_id` required, the list's unique index dropped                        | Done  |
| 2   | `SolutionOffers`: the offers of the solution's organization only; an operator's offer names its organization and the mark; a member cannot change an offer GenAI Fund arranged; `AdminCreateOffer` and `AdminSaveOffer`  | Done  |
| 3   | `SolutionTest` and `SearchDirectoriesTest`, the matrix in `docs/tests/solution.md`, `openapi.yml` and the generated web client                                                                                           | Done  |
| 4   | Web: the operator's dialog with the mark, opened from the picker on a solution's record; Admin › Offers by organization with the mark and no new offer; an organization's offers marked, with no actions on GenAI Fund's | Done  |
| 5   | End-to-end tests: `admin-offers.spec.ts`, `workspace-solutions.spec.ts`                                                                                                                                                  | Done  |
| 6   | After the release: Builder Hub's open perks entered for their organizations on production                                                                                                                                | To do |
