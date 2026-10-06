# Search: plan

Design: [design.md](design.md). Tracked in Linear as BEY-65.

| #   | Step                                                                                                                                                                                                                                                                                                                                                            | State                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 0   | This design and plan, reviewed by Đạt; the event changes in `solution`, `talent` and `organization` agreed with Việt                                                                                                                                                                                                                                            | Done                          |
| 1   | Backend: `spring-modulith-starter-jdbc`; `V15__matching_create_event_publication.sql` (named before the module became `search`; applied, so kept) from the Spring Modulith 2 PostgreSQL schema; completion mode `delete`; republish on restart; the event conventions in the backend guide                                                                      | Done                          |
| 2   | Backend: the `search` module, closed, in `ModulithArchitectureTest`; `V16__search_create_documents.sql` with `unaccent`, `pg_trgm`, the immutable unaccent function, the table, the generated weighted vector and its indexes; `SearchDocumentRepository` with the fused ranking, counts per kind and paging; integration tests for accents, typos and prefixes | Done                          |
| 3   | Backend: `ProgramChanged` and `ProgramService.indexed`; the listener that builds the card and upserts or removes the row; the nightly comparison and the full rebuild; `Scenario` tests                                                                                                                                                                         | Done                          |
| 4   | Backend: `SolutionChanged` with `SolutionDirectory.indexed`, `TalentProfileChanged` with `TalentDirectory.indexed`, `OrganizationChanged`; their listeners and their part of the repair; an unchanged save leaves its row alone. Đạt let this team change Việt's modules on 6 October                                                                           | Done                          |
| 5   | Backend: `GET /api/search` over the repository's ranking, with the limits on the query and the page; `openapi.yml` and the generated web client refreshed; `docs/tests/search.md`                                                                                                                                                                               | Done                          |
| 6   | Web: `/search` from the approved drawing (All tab, kind tabs, no results), `noindex`, both catalogs, end-to-end tests; `search` removed from the coming-soon pages                                                                                                                                                                                              | After the drawing is approved |
| 7   | Documents made true: `ARCHITECTURE.md`, the backend guide, the roadmap                                                                                                                                                                                                                                                                                          | With each step                |

Each step is one pull request, merged when its CI is green, except that steps 2, 3 and 5 share one: the `search` module whole, which Đạt asked for on 6 October. Step 4 stays apart because it changes Việt's modules.

The AI slice follows in its own increment once BEY-21 has chosen the model: the embedding columns on `search_document`, the batch embedding job, the vector branch of the ranking with HNSW, and the operators' Search and AI screen, drawn and approved first. Use cases join when their public listing exists.

## Verification

- `./gradlew :backend:check`, with the integration and `Scenario` tests listed in the design.
- `pnpm --dir web check` and `pnpm --dir web test:e2e`.
- On staging after each backend step: an approved item found within seconds; the event publication table empty when idle.

## Needed from outside the code

| What                                                                                 | For                               | Where it is managed                                                                   |
| ------------------------------------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------- |
| Việt's agreement and review of the events in `solution`, `talent` and `organization` | Step 4                            | Linear, BEY-65                                                                        |
| Đạt's approval of the search drawings                                                | Step 6                            | Figma, section "Search — results (draft for review)"                                  |
| Whether an unlisted talent profile stays eligible for matching                       | The rule of what enters the index | BEY-41                                                                                |
| The OpenAI API key                                                                   | The AI slice                      | A deployment secret on the staging host, sent by GenAI Fund through a private channel |
