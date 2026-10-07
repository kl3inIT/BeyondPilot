# Import from the old platform

Status: in progress, 7 October 2026. Tracked in [BEY-74](https://linear.app/beyondpilot/issue/BEY-74) (startups) and [BEY-75](https://linear.app/beyondpilot/issue/BEY-75) (use cases). It carries out the [migration from v1](../bey-22-phase-1-domain-model/design.md#migration-from-v1) of BEY-22 against the real export, and uses the [review lifecycle](../bey-76-review-lifecycle/design.md).

## Source

GenAI Fund's export `genai_matching_db_export_2026-10-04-2.xlsx`, two sheets, each with a title and a note above the header on the fourth row:

| Sheet | Records | Holds |
| --- | --- | --- |
| Startups | 2,426 (2,125 active) | Company facts, product fields, links to decks, demos and logos on `papi.genaifund.ai` |
| Use Cases | 233 (218 approved) | Title, description, content, tags, price, deadline, the enterprise's id, name and industry, the creator, links to attachments |

The file holds names and email addresses, so it is never committed; it is uploaded to the running application by an operator. It has no users, proposals or matching decisions. The attachment links answer without a session.

## Decisions

1. **Imported, not approved.** GenAI Fund has not said how it wants the old records reviewed (BEY-41), so an organization and an active startup's solution arrive `in_review`, an inactive startup's solution and every use case arrive `draft`. A solution is not listed. Nothing imported is public until an operator approves it.
2. **One run on staging, a clean copy to production.** No table maps v1 identifiers to new ones. The import runs on staging; test records and duplicates are removed there; production then receives the same clean result. How production receives it is decided when staging is clean: the same import with the exclusions written into its rules, or a copy of the imported rows and files.
3. **Through each module's API.** The import writes organizations, solutions and use cases through their modules, so validation, `*Changed` events, the search index and the audit log behave as for any record. Each module offers one operator method for it, which leaves with the import after the cutover.
4. **A use case may be drafted for an organization in review.** An operator could only create a use case for an approved organization; the 46 enterprises arrive in review. An operator may now draft one for any organization that is not refused; approving it still needs an approved organization.
5. **A use case belongs to programs.** 167 use cases carry a program tag in v1 (AABW2026, Shinhan Innoboost 2026, Tasco Innovation Day, GOI Malaysia, Indonesia and Japan 2025, Nestlé Vietnam AI Reinvention). `usecase` stores `use_case_program (use_case_id, program_id)` and depends on `program` to check the program exists; the public list narrows by program, so a program page reads its use cases from `usecase` and `program` does not depend on `usecase`. Nestlé Vietnam AI Reinvention is created as a draft program; its details wait for GenAI Fund.
6. **Files are fetched by the server.** `storage` stores bytes the server fetched, for an operator, with the purpose's media types and size limits. The import fetches only from `https://papi.genaifund.ai/attachments/`, one at a time, with a timeout, and a file that fails is reported, never fatal.
7. **A run is recorded.** `legacy_import_run` keeps each run's time, operator, mode (dry run or apply), counts and report, so what was imported and what was left out stays readable after the export is gone.
8. **Values are mapped, not copied.** Solution types to focus areas, industries to industry codes, product stage to maturity, country names to ISO codes, `|||` and comma lists split, empty strings and "Not specified" to null. Test records (`test`, `[TEST]`, `test.com`) are left out and reported. Startups sharing a registrable domain or a normalised name are reported as possible duplicates, not merged. A value with no code is reported, not stored as free text. A budget in VND is converted at a stated rate; `TBD` and `0` become "to be determined". The v1 `Source` column and company type are counted in the report only.

## API

Operators only, under `/api/legacy/admin`:

| Request | Does |
| --- | --- |
| `POST /imports?mode=dry_run` with the file | Reads and maps the file, writes nothing, returns the report |
| `POST /imports?mode=apply` with the file | Starts the import in the background, returns the run |
| `GET /imports/{id}` | The run: status, counts, report |

## Module

`legacy` is a new module that depends on `audit`, `identity`, `organization`, `solution`, `usecase`, `program` and `storage`, and nothing depends on it. It reads the workbook with Apache POI. It is removed, with its endpoint and the operator methods it uses, once v1 is switched off.
