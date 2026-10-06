# AI providers and the search index in Admin: plan

Design: [design.md](design.md). Tracked in Linear as BEY-72.

| #   | Step                                                                                                                                                                                                                                                                            | State |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 0   | The screens drawn in Figma and approved by Đạt; the plan agreed                                                                                                                                                                                                                 | Done  |
| 1   | Backend: `V42__search_add_ai_providers.sql`; providers sealed with the new key; the client built from the database; `SearchAdministration` and `/api/search/admin`; the audit actions; `SearchAdministrationTest` and the semantic tests moved to providers set in the database | Done  |
| 2   | Deployment: the `ai-encryption-key` secret on both hosts, required by `deploy.sh`; the `BEYONDPILOT_AI_*` settings and the `ai-api-key` mapping removed from the overlays                                                                                                       | Done  |
| 3   | Web: Admin › AI › Providers and Search index from the approved drawing, both catalogs, the audit log's new actions, end-to-end tests                                                                                                                                            | Done  |
| 4   | On staging: OpenRouter connected through the screen by Đạt, the model chosen, and semantic search checked again with the Vietnamese queries                                                                                                                                     | Done  |

The old `ai-api-key` files stay on the hosts until Đạt agrees to delete them.
