# Plan: import from the old platform

Design: [design.md](design.md). Tracked in [BEY-74](https://linear.app/beyondpilot/issue/BEY-74) and [BEY-75](https://linear.app/beyondpilot/issue/BEY-75). Branch `dathip04/bey-74-v1-import`, one commit per step, one pull request.

| Step | What | Done when |
| --- | --- | --- |
| 1 | `storage` stores bytes the server fetched, for an operator | `StorageServiceTest` passes |
| 2 | `organization`, `solution`, `usecase`: one operator import method each; a use case drafted for an organization in review | Module tests pass |
| 3 | `usecase`: `use_case_program`, programs on the operator's create and save, the public list narrowed by program; Nestlé Vietnam AI Reinvention as a draft program | `UseCaseServiceTest` passes |
| 4 | `legacy`: read and map the workbook, the dry-run report | A test workbook maps to the expected report |
| 5 | `legacy`: apply in the background, fetch files, record the run | An import of the test workbook creates the records once |
| 6 | Both gates, CI, merge; a dry run then an apply on staging with the real export; the report on Linear | The pull request is merged and staging holds the import |

## Next

- Remove the test records and duplicates on staging, then carry the result to production (design, decision 2).
- AI enrichment of the imported solutions and the requirements of the imported use cases.
- Remove `legacy` and the import methods once v1 is switched off.
