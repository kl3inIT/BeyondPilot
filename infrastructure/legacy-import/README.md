# Import from the old platform

A one-off load of GenAI Fund's v1 export (startups and use cases) into BeyondPilot, as decided in the [import design](../../docs/increments/active/bey-74-v1-import/design.md). `report.py` only reads and maps the export and reports what an import would do. `build.py` fetches the files v1 names (on v1 or, when public, on Google Drive, Slides and Docs) and writes one SQL file that loads everything into a database, for whichever environment runs it.

| File | Holds |
| --- | --- |
| `vocabulary.py` | The codes BeyondPilot accepts, copied from the backend |
| `check_vocabulary.py` | Fails when `vocabulary.py` no longer matches the backend |
| `mapping.py` | How each v1 value becomes a code; a value with no code is reported, never stored as free text |
| `report.py` | Reads the export and writes the report |
| `records.py` | The organizations, solutions, use cases and files the export becomes |
| `fetch.py` | Fetches a file from v1's API or Google's public download addresses only, checks its type and size, and caches it |
| `build.py` | Writes `load.sql` and the files in the local object store's layout |
| `enrich_fetch.py`, `enrich_render.py` | Enrichment stage 1: each startup's deck text, website pages and logo and cover candidates; pages built by JavaScript and SVG logos read in headless Chromium |
| `enrich_check.py` | Keeps a researched value only when its quote is in the saved source and the value is a code BeyondPilot accepts |
| `enrich_apply.py` | Writes `update.sql` (empty parts filled, customers added) and `audit.sql` (one `solution.enrich` event per solution, with each value's quote and source) |
| `enrich_images.py` | Writes the found logos and covers into the object store's layout and `images.sql` |
| `usecase_extract.py`, `usecase_check.py` | Fill the imported use cases' empty fields from their v1 briefs, and approve them |

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
- `load.sql`, `files/` and `build.json`: the load and what was fetched or refused. They hold the export's content and stay with it.

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

## Enrich

After the load, empty parts of the imported records are filled from public sources: the startup's deck, its website and, when the site is missing or dead, a web search. Nothing already there is overwritten, except the summary v1 generated ("Company founded in … focusing on: …"). A value is stored only with a verbatim quote from a saved source, and the quote goes to the audit log, which only operators read; nothing new is published about where it came from.

1. Stage 1, no AI: `enrich_fetch.py <input.json> <work>`, then `enrich_render.py <input.json> <work>` for what needs a browser (`playwright install chromium` once).
2. Stage 2, research: an agent per batch reads only the saved files, checks the site is still the same company, and writes `results/<id>.json`: for each value it fills, the quote and the source file.
3. Stage 3: `enrich_check.py <work>`, then `enrich_apply.py <work> <out>`. Dump the database, run `update.sql`, then `audit.sql` once the application knows the `solution.enrich` action, and `images.sql` from `enrich_images.py` after copying its files like step 2 of the load.
4. Use cases: `usecase_extract.py <export.xlsx> <work>` and `usecase_check.py <work>`; run `update.sql`, then `approve.sql`.
5. Rebuild the search index.

The work folders hold the companies' pages and decks: they stay under `.tmp/` and are never committed.
