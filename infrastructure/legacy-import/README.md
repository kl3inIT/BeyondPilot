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
