# BEY-96 — plan

Design: [design.md](design.md). Tracked in Linear as BEY-96. One branch and one pull request.

| #   | Step                                                                                                                                             | State                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| 1   | This design and plan; Đạt's decisions (operators only, XLSX and CSV, English headers, every list in the table)                                   | Done, 14 October 2026 |
| 2   | `shared`: `Spreadsheet` with its workbook and CSV, Fesod in the catalog, `SpreadsheetTest`                                                       | Done, 14 October 2026 |
| 3   | `proposal`: applications and drafts through `Spreadsheet` with a format, `CsvRows` removed; the proposals of a use case                          | Open                  |
| 4   | `organization`, `solution`, `talent`, `ai`: an export beside each list, its audit action and tests                                               | Open                  |
| 5   | `identity`: the audit log's export                                                                                                               | Open                  |
| 6   | `openapi.yml`, the generated client; web: `ExportMenu`, the eight pages, the audit log's actions, both catalogs, the stub backend and Playwright | Open                  |
| 7   | Documents: `ARCHITECTURE.md`, specs and test matrices, the roadmap                                                                               | Open                  |
| 8   | Staging: download each list in both formats, open the workbooks in Excel, check the audit log                                                    | Open                  |

## Verification

- `./gradlew :backend:check`: `SpreadsheetTest` reads each workbook back with POI (headers, groups, freeze, filter, cell types, links, About, styles per column) and the CSV byte for byte; each module's test downloads as an operator, is refused as anyone else with nothing recorded, carries its filters, and records the count.
- `pnpm --dir web check` and `pnpm --dir web test:e2e`: the Export menu saves the file the stub answers, in the format chosen.
- Step 8, which no test replaces: how the workbook looks in Excel on Windows and macOS.
