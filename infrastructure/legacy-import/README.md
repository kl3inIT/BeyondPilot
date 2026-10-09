# Import from the old platform

A one-off load of GenAI Fund's v1 export (startups and use cases) into BeyondPilot, as decided in the [import design](../../docs/increments/active/bey-74-v1-import/design.md). `report.py` reads and reconciles the export. `build.py` writes the duplicate-protected `load.sql`, a targeted `v1-details.sql` refresh for rows from an earlier load, and the files needed by the database's local object store.

| File | Holds |
| --- | --- |
| `vocabulary.py` | The codes BeyondPilot accepts, copied from the backend |
| `check_vocabulary.py` | Fails when `vocabulary.py` no longer matches the backend |
| `mapping.py` | Maps controlled v1 values to BeyondPilot codes; reports unsupported codes and leaves descriptive company claims as statements |
| `report.py` | Reads the export and writes the report |
| `records.py` | The organizations, solutions, use cases and file references the export becomes, including the v1 solution-detail fields |
| `fetch.py` | Fetches a file from v1's API or Google's public download addresses only, checks its type and size, and caches it |
| `build.py` | Writes `load.sql`, `v1-details.sql` and the files in the local object store's layout |
| `enrich_fetch.py`, `enrich_render.py` | Enrichment stage 1: each startup's deck text, website pages and logo and cover candidates; pages built by JavaScript and SVG logos read in headless Chromium |
| `enrich_check.py` | Keeps a researched value only when its quote is in the saved source and the value is a code BeyondPilot accepts |
| `enrich_apply.py` | Writes `update.sql` (empty parts filled, customers added) and `audit.sql` (one `solution.enrich` event per solution, with each value's quote and source) |
| `enrich_images.py` | Writes the found logos and covers into the object store's layout and `images.sql` |
| `usecase_extract.py`, `usecase_check.py` | Fill the imported use cases' empty fields from their v1 briefs, and approve them |
| `passages.py` | Writes `passages.sql`: the saved website text of each imported solution as the passages search keeps for matching, without the lines every page of a site repeats |

## Run

From the repository root, with Python 3.12 or newer:

```sh
python -m venv .tmp/legacy-import/venv
.tmp/legacy-import/venv/Scripts/python -m pip install -r infrastructure/legacy-import/requirements.txt
.tmp/legacy-import/venv/Scripts/python -I infrastructure/legacy-import/check_vocabulary.py
.tmp/legacy-import/venv/Scripts/python -I infrastructure/legacy-import/report.py <export.xlsx> .tmp/legacy-import/out
.tmp/legacy-import/venv/Scripts/python -I infrastructure/legacy-import/build.py <export.xlsx> .tmp/legacy-import/out .tmp/legacy-import/cache
```

The build fetches each file once into the cache, so a second run fetches nothing.

`-I` keeps Python from loading modules from the current directory. On Linux and macOS the interpreter is `venv/bin/python`.

## Outputs

- `summary.md`: counts only. It may go on Linear.
- `report.md`: names companies, test records and duplicates. It stays on the machine that ran it.
- `load.sql`, `v1-details.sql`, `files/` and `build.json`: the initial load, the targeted refresh and what was fetched or refused. They hold the export's content and stay with it.

The export, both reports and anything produced later from them are never committed: they hold names and email addresses. `.tmp/` is ignored by Git.

## Load into an environment

Staging first, then production, with the same `load.sql` and `files/` (the [design](../../docs/increments/active/bey-74-v1-import/design.md), decision 4). On the host, from the environment's directory:

1. Dump the database: `docker compose exec -T postgres pg_dump -U beyondpilot -Fc beyondpilot > before-legacy.dump`.
2. Copy the files into the object store, keeping their paths: `docker compose cp files/. api:/var/lib/beyondpilot/storage/`, then make them the api user's (`docker compose exec -u root api chown -R 1654:1654 /var/lib/beyondpilot/storage`, the uid of `backend/Dockerfile`).
3. Find the operator account: `docker compose exec -T postgres psql -U beyondpilot -d beyondpilot -tAc "select id, email from identity_account where platform_role = 'operator'"`.
4. Load: `docker compose exec -T postgres psql -U beyondpilot -d beyondpilot -v ON_ERROR_STOP=1 -v operator=<id> -f - < load.sql`. It runs in one transaction and ends with a notice of what it wrote; a second run of the same export is refused and changes nothing.
5. **Staging only:** approve the imported organizations and approve and list every imported solution, so matching is built on real data: `python -I infrastructure/legacy-import/staging_list.py .tmp/legacy-import/out/load.sql > .tmp/legacy-import/out/staging-list.sql`, then run it with `psql -v ON_ERROR_STOP=1 -f -`. Production skips this step.
6. Rebuild the search index from Admin › AI › Search index.
7. Check the counts against `build.json` and the summary, and in Admin › Organizations and Solutions (In review on production, Approved on staging).
For an environment loaded before the detail columns were added, generate the current `v1-details.sql` from the same workbook and apply it after migrations V56 and V57. It updates only the imported company-size label and startup detail fields on deterministic v1 ids, including moving `Notable Paying Customers` out of `traction` and `Key Milestones` into it. It does not rerun the duplicate-protected load or alter review status or operator backing.

## Enrich

After the load, empty parts of the imported records are filled from public sources: the startup's deck, its website and, when the site is missing or dead, a web search. Nothing already there is overwritten, except the summary v1 generated ("Company founded in … focusing on: …"). A value is stored only with a verbatim quote from a saved source, and the quote goes to the audit log, which only operators read; nothing new is published about where it came from.

1. Stage 1, no AI: `enrich_fetch.py <input.json> <work>`, then `enrich_render.py <input.json> <work>` for what needs a browser (`playwright install chromium` once).
2. Stage 2, research: an agent per batch reads only the saved files, checks the site is still the same company, and writes `results/<id>.json`: for each value it fills, the quote and the source file.
3. Stage 3: `enrich_check.py <work>`, then `enrich_apply.py <work> <out>`. Dump the database, run `update.sql`, then `audit.sql` once the application knows the `solution.enrich` action, and `images.sql` from `enrich_images.py` after copying its files like step 2 of the load.
4. Use cases: `usecase_extract.py <export.xlsx> <work>` and `usecase_check.py <work>`; run `update.sql`, then `approve.sql`.
5. Rebuild the search index.

The work folders hold the companies' pages and decks: they stay under `.tmp/` and are never committed.

## Passages for matching

Matching reads what a solution's own material says ([design](../../docs/increments/active/bey-39-matching/design.md)). The website text the enrichment saved is loaded once; the application reads decks and customer cases itself.

1. `python -I infrastructure/legacy-import/passages.py <work> <out>` writes `passages.sql` and `passages.json` (the counts). On the export of 4 October 2026: 11,957 passages from 4,210 pages of 1,903 solutions, a fifth of the text left out as menus and footers.
2. On the host, after a dump: `docker compose exec -T postgres psql -U beyondpilot -d beyondpilot -v ON_ERROR_STOP=1 -f - < passages.sql`. It runs in one transaction, keeps only the passages of solutions that exist, and ends with a notice of what it kept. Running it again replaces what it loaded before.
3. The passages are embedded by the job that embeds the index, 64 a minute by default (`beyondpilot.search.embedding.passage-batch-size`).
