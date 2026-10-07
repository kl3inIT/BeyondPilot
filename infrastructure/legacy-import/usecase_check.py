"""Check the values found for the imported use cases and write the SQL that stores them.

A value is kept only when its quote is found in the saved source it names (whitespace and case aside) and the value
is one the application accepts. The kept values become `update.sql`, which fills a field only while it is still
empty, so nothing an operator has written since is overwritten. `approve.sql` approves the imported drafts; run it
only once the application accepts an approved use case with these fields empty.

    python -I usecase_check.py <work folder>
"""

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # run with -I, so the folder is added explicitly

from vocabulary import TECHNOLOGY

TEXT = ("current_process", "target_users", "data_readiness", "integration_requirements")


def squash(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def found(quote: str, source: Path) -> bool:
    return bool(quote) and source.is_file() and squash(quote) in squash(source.read_text(encoding="utf-8"))


def valid(field: str, value) -> str | None:
    if field in TEXT:
        return None if isinstance(value, str) and value.strip() and len(value) <= 1600 else "empty or too long"
    if field == "technologies":
        ok = isinstance(value, list) and value and all(v in TECHNOLOGY for v in value)
        return None if ok else "unknown technology"
    if field == "timeline":
        ok = isinstance(value, list) and len(value) == 2 and 1 <= value[0] <= value[1] <= 260
        return None if ok else "timeline out of range"
    return "unknown field"


def literal(text: str) -> str:
    return "'" + text.replace("'", "''") + "'"


def main() -> None:
    work = Path(sys.argv[1])
    updates, ids, dropped, kept = [], [], [], {}
    for path in sorted((work / "results").glob("*.json")):
        result = json.loads(path.read_text(encoding="utf-8"))
        uid = result["id"]
        ids.append(uid)
        sets = []
        for field, item in result["fields"].items():
            reason = valid(field, item.get("value")) or (
                None if found(item.get("quote", ""), work / item.get("source", "")) else "quote not in source")
            if reason:
                dropped.append((result["title"], field, reason))
                continue
            kept[field] = kept.get(field, 0) + 1
            value = item["value"]
            if field in TEXT:
                sets.append(f"{field} = coalesce(nullif({field}, ''), {literal(value)})")
            elif field == "technologies":
                codes = ", ".join(literal(code) for code in value)
                sets.append(f"technologies = case when cardinality(technologies) = 0 then array[{codes}]::text[]"
                            " else technologies end")
            else:
                sets.append(f"timeline_min_weeks = coalesce(timeline_min_weeks, {value[0]})")
                sets.append(f"timeline_max_weeks = case when timeline_min_weeks is null then {value[1]}"
                            " else timeline_max_weeks end")
        if sets:
            updates.append(f"update use_case set {', '.join(sets)}, updated_at = now() where id = '{uid}';")
    header = ("-- The imported use cases' empty fields, filled from their v1 briefs by infrastructure/legacy-import.\n"
              "-- A field is written only while it is still empty.\n\\set ON_ERROR_STOP on\nbegin;\n")
    (work / "update.sql").write_text(header + "\n".join(updates) + "\ncommit;\n", encoding="utf-8")
    approve = ("-- Approve the imported use cases. Run only once the application accepts an approved use case whose\n"
               "-- optional fields are empty.\n\\set ON_ERROR_STOP on\nbegin;\n"
               "update use_case set status = 'approved', published_at = coalesce(published_at, now()),"
               " reviewed_at = now()\nwhere status = 'draft' and id in (\n"
               + ",\n".join(f"'{uid}'" for uid in ids) + "\n);\ncommit;\n")
    (work / "approve.sql").write_text(approve, encoding="utf-8")
    print(f"{len(ids)} use cases, {len(updates)} updated, kept {kept}, {len(dropped)} dropped")
    for title, field, reason in dropped:
        print(f"  dropped: {title[:60]} / {field}: {reason}")


if __name__ == "__main__":
    main()
