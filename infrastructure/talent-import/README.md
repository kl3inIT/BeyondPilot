# Import of the Agentic AI Build Week registrations

A one-off load of the builders who registered for Agentic AI Build Week into talent profiles, as decided in the [import design](../../docs/increments/active/bey-90-aabw-talent-import/design.md). `report.py` only reads and maps the file and reports what an import would do. `build.py` writes one SQL file that loads the profiles into a database, for whichever environment runs it.

| File | Holds |
| --- | --- |
| `vocabulary.py` | The codes a talent profile accepts, copied from the backend |
| `check_vocabulary.py` | Fails when `vocabulary.py` no longer matches the backend |
| `mapping.py` | How each answer of the registration becomes a value of a profile; an answer with no code is left empty or reported, never moved to the nearest code |
| `records.py` | Who becomes a profile, and the profile each registration becomes |
| `report.py` | Reads the file and writes the report |
| `build.py` | Writes `load.sql`: an account for each address that has none and a hidden draft profile for each account that has none |
| `staging_list.py` | Staging only: writes the SQL that suppresses the addresses of fifty people and approves and lists their profiles |

## Run

From the repository root, with Python 3.12 or newer:

```sh
python -m venv .tmp/talent-import/venv
.tmp/talent-import/venv/Scripts/python -m pip install -r infrastructure/talent-import/requirements.txt
.tmp/talent-import/venv/Scripts/python -I infrastructure/talent-import/check_vocabulary.py
.tmp/talent-import/venv/Scripts/python -I infrastructure/talent-import/report.py <registrations.xlsx> .tmp/talent-import/out
.tmp/talent-import/venv/Scripts/python -I infrastructure/talent-import/build.py <registrations.xlsx> .tmp/talent-import/out
```

`-I` keeps Python from loading modules from the current directory. On Linux and macOS the interpreter is `venv/bin/python`.

## Outputs

- `summary.md`: counts only. It may go on Linear.
- `report.md`: names people. It stays on the machine that ran it.
- `load.sql` and `build.json`: the load and its counts. `load.sql` holds the registrations' content and stays with them.

The registrations, the report and anything produced later from them are never committed: they hold names and email addresses. `.tmp/` is ignored by Git.

## Load into an environment

Staging first. On the host, from the environment's directory:

1. Dump the database: `docker compose exec -T postgres pg_dump -U beyondpilot -Fc beyondpilot > before-aabw.dump`.
2. Load: `docker compose exec -T postgres psql -U beyondpilot -d beyondpilot -v ON_ERROR_STOP=1 -f - < load.sql`. It runs in one transaction and ends with a notice of what it wrote. An account that exists is used as it is, and a person who has a profile keeps it untouched, so a second run adds only what is missing.
3. **Staging only:** suppress the addresses of fifty people and approve and list their profiles: `python -I infrastructure/talent-import/staging_list.py <registrations.xlsx> > .tmp/talent-import/out/staging-list.sql`, then run it with `psql -v ON_ERROR_STOP=1 -f -`. Production skips this step.
4. Rebuild the search index from Admin › AI › Search index.
5. Check the counts against `build.json`, the directory at `/talent` and one profile, and that an enquiry to a shown profile sends nothing (Admin › Email › Activity shows it as suppressed).
