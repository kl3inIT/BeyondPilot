# BEY-136 — plan

Design: [design.md](design.md). Tracked in Linear as BEY-136; one branch, one pull request, stacked on BEY-127 until that merges.

| #   | Step                                                                                                                                                                                                              | State                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 1   | Backend: `size` on every paged list request, the two cursor lists and `search`; `country` and `countries` on the operators' list of organizations; `OrganizationTest`; `openapi.yml` and the generated web client | Done, 11 October 2026  |
| 2   | Web: `pageSize` parser and `PageSizeSelect`; the control in `ListFooter`, `DataTableFooter` and `DataTablePager`; `size` in every list's URL description, query and page links                                    | Done, 11 October 2026  |
| 3   | Web: the country filter on Admin › Organizations, both catalogs                                                                                                                                                   | Done, 11 October 2026  |
| 4   | Web: one search field per surface                                                                                                                                                                                 | Done, 11 October 2026  |
| 5   | Figma: the page-size control in the pagination component, the country filter on the Organizations frames, the 48px field on the use case directory                                                                | Open                   |
| 6   | Directories searched by meaning: decide between the options in the design, then build                                                                                                                             | Open, needs a decision |

## Verification

- `./gradlew :backend:check`
- `pnpm --dir web check` and `pnpm --dir web test:e2e`
- By hand against the local stack: change the size on Admin › Organizations from a late page and land on page 1; filter by country and clear it; open the Members tab of an organization with more than ten members; change the size on `/solutions`.
