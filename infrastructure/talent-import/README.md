# Import of the Agentic AI Build Week registrations

A one-off load of the builders who registered for Agentic AI Build Week into talent profiles, as decided in the [import design](../../docs/increments/active/bey-90-aabw-talent-import/design.md). `report.py` only reads and maps the file and reports what an import would do.

| File | Holds |
| --- | --- |
| `vocabulary.py` | The codes a talent profile accepts, copied from the backend |
| `check_vocabulary.py` | Fails when `vocabulary.py` no longer matches the backend |
| `mapping.py` | How each answer of the registration becomes a value of a profile; an answer with no code is left empty or reported, never moved to the nearest code |
| `records.py` | Who becomes a profile, and the profile each registration becomes |
| `report.py` | Reads the file and writes the report |

## Run

From the repository root, with Python 3.12 or newer:

```sh
python -m venv .tmp/talent-import/venv
.tmp/talent-import/venv/Scripts/python -m pip install -r infrastructure/talent-import/requirements.txt
.tmp/talent-import/venv/Scripts/python -I infrastructure/talent-import/check_vocabulary.py
.tmp/talent-import/venv/Scripts/python -I infrastructure/talent-import/report.py <registrations.xlsx> .tmp/talent-import/out
```

`-I` keeps Python from loading modules from the current directory. On Linux and macOS the interpreter is `venv/bin/python`.

## Outputs

- `summary.md`: counts only. It may go on Linear.
- `report.md`: names people. It stays on the machine that ran it.

The registrations, the report and anything produced later from them are never committed: they hold names and email addresses. `.tmp/` is ignored by Git.
