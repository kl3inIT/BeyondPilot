# Plan: import from the old platform

Design: [design.md](design.md). Tracked in [BEY-74](https://linear.app/beyondpilot/issue/BEY-74) and [BEY-75](https://linear.app/beyondpilot/issue/BEY-75). Branch `dathip04/bey-74-solution-detail-fields`.

| Step | What | Done when |
| --- | --- | --- |
| 1 | `usecase`: `use_case_program`, programs on the operator's create, `PUT …/programs` and the operator's response, the public list narrowed by program; a budget's currency (USD or VND) with the approved Currency select | Both gates pass; merged |
| 2 | Script: read and map the workbook, write the report, no SQL yet | The report on the real export is reviewed |
| 3 | Script: the SQL and the files, for one environment's operator account | It loads into a local database cleanly |
| 4 | Staging: dump, load, rebuild the search index, review in Admin, remove test records and duplicates with kept SQL | The counts are on Linear |
| 5 | Production: dump, the same load and removals, rebuild the index | The counts match staging |
| 6 | Imported startup details: schema, refresh SQL, public response, generated web client, detail page, both locales and regressions | Approved solution pages show each v1 field under its correct meaning and attribution; backend and web checks pass |

## Next

- The screens that show a use case's programs, let an operator pick them, and list a program's use cases, once drawn and approved; until then programs are set through the API.
- AI enrichment of the imported solutions and the requirements of the imported use cases.
