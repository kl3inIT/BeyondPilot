# Import from the old platform

Status: in progress, 7 October 2026. Tracked in [BEY-74](https://linear.app/beyondpilot/issue/BEY-74) (startups) and [BEY-75](https://linear.app/beyondpilot/issue/BEY-75) (use cases). It carries out the [migration from v1](../bey-22-phase-1-domain-model/design.md#migration-from-v1) of BEY-22 against the real export, and uses the [review lifecycle](../bey-76-review-lifecycle/design.md).

## Source

GenAI Fund's export `genai_matching_db_export_2026-10-04-2.xlsx`, two sheets, each with a title and a note above the header on the fourth row:

| Sheet | Records | Holds |
| --- | --- | --- |
| Startups | 2,426 (2,125 active) | Company facts, product fields, links to decks, demos and logos on `papi.genaifund.ai` |
| Use Cases | 233 (218 approved) | Title, description, content, tags, price, deadline, the enterprise's id, name and industry, the creator, links to attachments |

The file holds names and email addresses, so it is never committed. It has no users, proposals or matching decisions. The attachment links answer without a session.

## Decisions

1. **A one-off load, not a feature.** The brief asks for a migration that reconciles with its source (§11), not for an import function; the export it asks for (§7.10) is operational reporting and comes separately. The records are written once, so the application gains no import module, endpoint or operator method that would have to be removed after the cutover.
2. **A script writes the database.** `infrastructure/legacy-import/` reads the workbook, maps the values, fetches the files and writes one SQL file and a folder of files. Its rules are code in the repository; the workbook, the SQL and the files it produces are not. The SQL runs in one transaction under the database's constraints; the search index is then rebuilt from Admin › AI, since no event is published. One audit event records the load.
3. **Imported, not approved.** GenAI Fund has not said how it wants the old records reviewed (BEY-41), so an organization and an active startup's solution arrive `in_review`, an inactive startup's solution and every use case arrive `draft`. A solution is not listed. An organization has no member and is created by the operator account of the environment. Nothing imported is public until an operator approves it.
4. **Staging first, then production.** The load runs on staging; test records and duplicates are removed there with SQL that is kept with the script. Production receives the same load and the same removals, after a dump of its database.
5. **A use case belongs to programs.** 167 use cases carry a program tag in v1. `usecase` stores `use_case_program (use_case_id, program_id)` and depends on `program`; an operator sets a use case's programs, and the public list narrows by program, so a program page reads its use cases from `usecase` and `program` does not depend on `usecase` ([brief §9](../../../brief/BeyondPilot-Vendor-Product-Brief-and-Scope.md#9-example-operating-scenario): a campaign has linked use cases). This is the one change to the application. Nestlé Vietnam AI Reinvention, which only v1 names, is created as a draft program; its details wait for GenAI Fund.
6. **Values are mapped, not copied.** Solution types to focus areas, industries to industry codes, product stage to maturity, country names to ISO codes, `|||` and comma lists split, empty strings and "Not specified" to null. Test records (`test`, `[TEST]`, `test.com`) are left out. Startups sharing a registrable domain or a normalised name are reported as possible duplicates, not merged. A value with no code is reported, not stored as free text. The v1 `Source` column and company type are counted in the report only.
7. **Files are fetched only from v1.** The script fetches from `https://papi.genaifund.ai/attachments/` alone, one at a time with a timeout, checks the media type and size each purpose allows, and reports a file that fails without stopping.
8. **The report is the reconciliation.** Each run writes the counts read, written, left out and why, and the possible duplicates. Its counts go on Linear; the full report, which names companies, stays with the workbook.
