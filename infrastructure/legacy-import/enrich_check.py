"""Check what the research agents found before anything reaches a database.

Each results/<id>.json names, for every value it fills, a verbatim quote and the saved source file it came from.
A value is kept only when its quote is found in that file (whitespace and case aside) and the value is one the
application accepts. The rest is reported with the reason.

    python -I enrich_check.py <work folder>

writes <work folder>/checked.json (the values kept) and prints a summary.
"""

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # run with -I, so the folder is added explicitly

from vocabulary import FOCUS_AREA, INDUSTRY, MATURITY, TEAM_SIZE

TEXT_FIELDS = {"summary": 280, "problems_solved": 2000, "value_proposition": 2000, "best_customer_profile": 2000}


def squash(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def found(quote: str, source: Path) -> bool:
    if not quote or not source.is_file():
        return False
    text = source.read_text(encoding="utf-8", errors="replace")
    if squash(quote) in squash(text):
        return True
    # Japanese, Chinese and Vietnamese pages are often saved with spacing the quote does not keep.
    return re.sub(r"\s+", "", quote).lower() in re.sub(r"\s+", "", text).lower()


def valid(field: str, value) -> str | None:
    if field in TEXT_FIELDS:
        if not isinstance(value, str) or not value.strip():
            return "empty text"
        if len(value) > TEXT_FIELDS[field]:
            return "too long"
        return None
    if field == "maturity":
        return None if value in MATURITY else "unknown maturity"
    if field == "industries":
        ok = isinstance(value, list) and 0 < len(value) <= 3 and all(v in INDUSTRY for v in value)
        return None if ok else "unknown industry"
    if field == "focus_areas":
        ok = isinstance(value, list) and 0 < len(value) <= 3 and all(v in FOCUS_AREA for v in value)
        return None if ok else "unknown focus area"
    if field == "country":
        return None if isinstance(value, str) and re.fullmatch(r"[A-Z]{2}", value) else "not an ISO code"
    if field == "founded_year":
        return None if isinstance(value, int) and 1990 <= value <= 2026 else "year out of range"
    if field == "team_size":
        return None if value in TEAM_SIZE else "unknown team size"
    return "unknown field"


def main() -> None:
    work = Path(sys.argv[1])
    kept, dropped = {}, []
    for path in sorted((work / "results").glob("*.json")):
        result = json.loads(path.read_text(encoding="utf-8"))
        rid = result["id"]
        out = {"fields": {}, "customers": []}
        for field, item in (result.get("fields") or {}).items():
            reason = valid(field, item.get("value"))
            if reason is None and not found(item.get("quote", ""), work / item.get("source", "")):
                reason = "quote not in source"
            if reason:
                dropped.append((result.get("name"), field, reason))
            else:
                out["fields"][field] = item
        for customer in result.get("customers") or []:
            if customer.get("name") and found(customer.get("quote", ""), work / customer.get("source", "")) \
                    and squash(customer["name"]) in squash(customer.get("quote", "")):
                out["customers"].append(customer)
            else:
                dropped.append((result.get("name"), "customer " + str(customer.get("name")), "quote not in source"))
        for image in ("logo_url", "cover_url"):
            item = result.get(image) or {}
            if isinstance(item.get("value"), str) and item["value"].startswith("https://"):
                out[image] = item
        kept[rid] = out
    (work / "checked.json").write_text(json.dumps(kept, ensure_ascii=False, indent=2), encoding="utf-8")
    fields = sum(len(v["fields"]) for v in kept.values())
    customers = sum(len(v["customers"]) for v in kept.values())
    print(f"{len(kept)} startups, {fields} values kept, {customers} customers kept, {len(dropped)} dropped")
    for name, field, reason in dropped:
        print(f"  dropped: {name} / {field}: {reason}")


if __name__ == "__main__":
    main()
