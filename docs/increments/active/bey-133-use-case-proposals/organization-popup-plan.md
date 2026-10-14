# Implementation plan

- [x] Extend the existing basics API with active required profile fields and per-type validation; preserve hidden optional profile facts on edit.
- [x] Implement the three-option picker and required-only conditional fields with shared form controls and existing Query refresh behavior.
- [x] Remove organization team-background inputs and validation; retain historical data without a destructive migration.
- [x] Extend schema, validation, integration and browser coverage, including switching and all three payloads.
- [ ] Regenerate contracts, run backend/frontend gates and exercise the local preview; record results.

## Verification and local handoff

OpenAPI and the generated client were refreshed. Lint, formatting, type and catalog checks passed before the final test-only updates. The focused organization schema/form run passed 28 tests. An earlier focused backend run passed 44 tests; added preservation coverage exposed the former type-dependent legacy-background clearing, which was corrected, and proposal integration fixtures were updated to use short description.

Full gates are not claimed green: the user requested stopping them and running local instead. Memory pressure also affected earlier attempts, including knip's native parser allocation.

The git-ignored local demo runs the web application at port 3000 and a seeded in-memory gateway at port 3189 over the existing fixture server at port 3190. Before main integration, browser smoke checks confirmed company/team/solo field counts of 7/4/2, a saved organization refreshing its wizard card, and the no-organization creation entry. Demo data is not a real database and resets when the gateway restarts or a demo entry link is reopened.

## Shipping follow-up

The user subsequently requested pulling main, opening a PR and merging after all CI checks pass. Main was integrated at `56273c3b`, preserving BEY-189's individual approval, naming and edit restrictions. Three creation types remain available; existing organization edits use only their permitted types. Local gates and CI are being rerun on the integrated branch; the earlier verification notes are historical, not a claim that the shipping gates are already green.
