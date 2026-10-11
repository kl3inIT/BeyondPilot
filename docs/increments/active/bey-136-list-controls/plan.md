# BEY-136 — plan

Design: [design.md](design.md). Tracked in Linear as BEY-136; pull request #202 integrates the latest `main` after BEY-127 merged.

| #   | Step                                                                                                                                                                                                              | State                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 1   | Backend: `size` on every paged list request, the two cursor lists and `search`; `country` and `countries` on the operators' list of organizations; `OrganizationTest`; `openapi.yml` and the generated web client | Done, 11 October 2026 |
| 2   | Web: `pageSize` parser and `PageSizeSelect`; the control in `ListFooter`, `DataTableFooter` and `DataTablePager`; `size` in every list's URL description, query and page links                                    | Done, 11 October 2026 |
| 3   | Web: the country filter on Admin › Organizations, both catalogs                                                                                                                                                   | Done, 11 October 2026 |
| 4   | Web: one search field per surface                                                                                                                                                                                 | Done, 11 October 2026 |
| 5   | Figma: the page-size control in the pagination component, the country filter on the Organizations frames, the 48px field on the use case directory                                                                | Open                  |
| 6   | Directories searched by meaning: accepted option 3; filtered hybrid `/api/search` for Solutions, Use Cases, Programs and Talent; preserve domain cards and pagination                                             | Done, 11 October 2026 |
| 7   | Public 48px search/select/multi-select controls and complete Talent role select; retain dense 32px admin controls                                                                                                 | Done, 11 October 2026 |
| 8   | Correct size-control visibility for custom small pages and one-page results; omit empty cursor navigation                                                                                                         | Done, 11 October 2026 |

## Verification

- `./gradlew :backend:check`
- `pnpm --dir web check` and `pnpm --dir web test:e2e`
- By hand against the local stack: change the size on Admin › Organizations from a late page and land on page 1; filter by country and clear it; open the Members tab of an organization with more than ten members; change the size on `/solutions`.
- Public directories: query, combine facets and sort, change the page size and reload the URL; verify identical 48px control heights at desktop and phone widths, and the Talent role select rather than role chips.
- Backend search: exercise semantic-only matches, filtering before a small candidate pool, filtered counts/pagination, and public visibility with the existing pgvector integration fixtures.

## Observed results, 11 October 2026

- Integrated `main` through `4524b81d` (PR #205), preserving the new Admin Solutions organization filter/options together with page size.
- `pnpm --dir web check` passed on that integration: API freshness, lint, formatting, typechecking, 142 unit tests, 4,930 matching catalog keys and unused-code checks.
- Ran the real Spring Boot API against isolated PostgreSQL 18/pgvector, then rendered the resulting Solutions search in the web app. Insurance filtering, newest ordering and size-one page links returned Voice routing then Voice intake. The four kind-specific API calls retained role/type/phase facets, excluded closed use cases and did not expose members-only budget amounts.
- Browser checks covered all four directories at desktop and phone widths: public search/select/multi-select controls were 48px, without horizontal overflow. Talent used the full role select; changing role narrowed the cards. Clearing Use Case industries and Program type retained the query.
- Backend and full desktop/mobile production-browser gates are running against the latest integration; their final results are recorded after completion.
