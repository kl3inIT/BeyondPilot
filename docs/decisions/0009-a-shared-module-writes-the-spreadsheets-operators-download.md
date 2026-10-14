# ADR 0009: A `shared` module writes the spreadsheets operators download

- Status: Accepted, implementation started 2026-10-14
- Date: 2026-10-14
- Decision owner: BeyondPilot team

## Context

Operators take lists out of BeyondPilot to work in Excel (brief §7.10). Before this decision `proposal` wrote two of them, a program's applications and its drafts, as CSV through its own `CsvRows`. On 14 October 2026 Đạt decided that every list operators work with downloads the same way, as an Excel workbook or as CSV: applications, drafts, a use case's proposals, organizations, solutions, talent, the AI calls and the audit log ([BEY-96](../increments/active/bey-96-spreadsheet-exports/design.md)). Seven modules write one.

Writing a styled workbook is not a module's business: it knows nothing of programs or organizations, and the same columns, styles, file names and row limit must hold in every module.

The [backend guide](../guidelines/backend.md#where-things-live) already keeps `shared` for "technical utilities that at least two modules need and that know nothing about any module", but no such utility existed, so the module did not.

## Decision

- **A module `shared`**, closed, with no dependency, holds `Spreadsheet`, `SpreadsheetFormat`, `SpreadsheetFile` and its failure `SPREADSHEET_TOO_LARGE`. It holds no Spring bean, no persistence and nothing about a module.
- **The modules that download declare `shared`**: `ai`, `audit`, `identity`, `organization`, `proposal`, `solution`, `talent`. Each keeps its own authorization, audit record and log line; `shared` only writes the file.
- **Apache Fesod** (`org.apache.fesod:fesod-sheet`) writes the files and is called only inside `Spreadsheet`. It was probed on Java 25 and Spring Boot 4.1.1 before the decision (BEY-96).
- **The audit log is downloaded through `identity`**, which reads it through `AuditLog.spreadsheet`: `audit` cannot name the caller ([ADR 0004](0004-the-filter-chain-keeps-the-audit-log-for-operators.md)), and a download must record who took it.

## Alternatives considered

- **Each module writes its own file**, as `proposal` did. Seven copies of the styles, the formula guard and the limit, and seven places to fix a change of library.
- **`Spreadsheet` in the base package**, beside `BusinessException`, which every module may use without declaring it. The guide keeps the base package for the application class and the failure types; a utility with a third-party library behind it is a module's, so its users declare it.
- **The browser writes the file** from the rows a page shows. The lists are paged, so a page holds a part of them, and a download of contact details must be authorized and recorded on the server.
- **The audit log's download in `audit`**, trusting the filter chain as its reading does. It could not record who downloaded it.

## Consequences

- `ModulithArchitectureTest` lists `shared`; a module that writes a spreadsheet adds `shared` to its allowed dependencies.
- `audit` now depends on a module, `shared`, which depends on none: ADR 0003's rule that `identity` can record through `audit` without a cycle still holds.
- A change of the spreadsheet library touches one class.
- Fesod is incubating at Apache. If its API changes, `Spreadsheet` absorbs it.
