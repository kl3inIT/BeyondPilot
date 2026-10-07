# Import from the old platform

A one-off load of GenAI Fund's v1 export (startups and use cases) into BeyondPilot, as decided in the [import design](../../docs/increments/active/bey-74-v1-import/design.md). This step only reads and maps the export and reports what an import would do; it writes nothing to any database and fetches nothing.

| File | Holds |
| --- | --- |
| `vocabulary.py` | The codes BeyondPilot accepts, copied from the backend |
| `check_vocabulary.py` | Fails when `vocabulary.py` no longer matches the backend |
| `mapping.py` | How each v1 value becomes a code; a value with no code is reported, never stored as free text |
| `report.py` | Reads the export and writes the report |

## Run

From the repository root, with Python 3.12 or newer:

```sh
python -m venv .tmp/legacy-import/venv
.tmp/legacy-import/venv/Scripts/python -m pip install -r infrastructure/legacy-import/requirements.txt
.tmp/legacy-import/venv/Scripts/python -I infrastructure/legacy-import/check_vocabulary.py
.tmp/legacy-import/venv/Scripts/python -I infrastructure/legacy-import/report.py <export.xlsx> .tmp/legacy-import/out
```

`-I` keeps Python from loading modules from the current directory. On Linux and macOS the interpreter is `venv/bin/python`.

## Outputs

- `summary.md`: counts only. It may go on Linear.
- `report.md`: names companies, test records and duplicates. It stays on the machine that ran it.

The export, both reports and anything produced later from them are never committed: they hold names and email addresses. `.tmp/` is ignored by Git.
