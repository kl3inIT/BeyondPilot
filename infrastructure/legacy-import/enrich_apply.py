"""Turn the checked enrichment into SQL for one environment.

    python -I enrich_apply.py <enrich folder> <out folder>

reads <enrich folder>/checked.json, input.json and the saved sources, and writes
- update.sql: the solution and organization parts still empty, and the customers named in the sources, in one
  transaction guarded by the operator account (psql -v operator=<uuid>);
- audit.sql: one `solution.enrich` audit event per solution enriched, with each value's quote and source. Run it only
  once the application knows the `solution.enrich` action, or the audit log cannot read the rows;
- apply.json: the counts.
Nothing is written where a value is already there, except a summary the old platform generated ("Company founded in
… focusing on: …").
"""

import json
import re
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # run with -I, so the folder is added explicitly

from vocabulary import FOCUS_AREA, INDUSTRY, MATURITY, TEAM_SIZE

NAMESPACE = uuid.UUID("5d0f6c3e-4a51-4f43-9a1c-7e2b8f0c6a74")
SOLUTION_TEXT = ("problems_solved", "value_proposition", "best_customer_profile")
SOLUTION_ARRAYS = {"industries": INDUSTRY, "focus_areas": FOCUS_AREA}
PILOT = re.compile(r"(?i)\b(pilot|trial|poc|proof of concept|piloting)\b")


def lit(value) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, list):
        return "array[" + ", ".join(lit(v) for v in value) + "]::text[]"
    return "'" + str(value).replace("'", "''") + "'"


def source_of(work: Path, source: str) -> str:
    """The URL a saved page came from, or 'deck'."""
    if source.endswith(".deck.txt"):
        return "deck"
    path = work / source
    if path.is_file():
        first = path.read_text(encoding="utf-8", errors="replace").split("\n", 1)[0].strip()
        if first.startswith("http"):
            return first
    return source


def main() -> None:
    work, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    checked = json.loads((work / "checked.json").read_text(encoding="utf-8"))
    records = {r["id"]: r for r in json.loads((work / "input.json").read_text(encoding="utf-8"))}

    update = ["-- The checked enrichment of the old platform's startups (infrastructure/legacy-import/enrich_apply.py).",
              "-- Run with: psql -v ON_ERROR_STOP=1 -v operator=<operator account uuid> -f update.sql",
              "\\if :{?operator}", "\\else",
              "  \\echo 'enrichment: give the operator account with -v operator=<uuid>'", "  \\quit", "\\endif",
              "\\set ON_ERROR_STOP on", "begin;", "select set_config('legacy.operator', :'operator', true);",
              "do $$ begin if not exists (select 1 from identity_account where id = current_setting('legacy.operator')"
              "::uuid and platform_role = 'operator' and status = 'active') then raise exception "
              "'enrichment: % is not an active operator account', current_setting('legacy.operator'); end if; end $$;"]
    audit = ["-- One `solution.enrich` audit event per solution the enrichment filled. Run only after the application",
             "-- knows the `solution.enrich` action (AuditAction.SOLUTION_ENRICH is deployed), or Admin › Audit log",
             "-- cannot read these rows. Run with: psql -v ON_ERROR_STOP=1 -v operator=<uuid> -f audit.sql",
             "\\if :{?operator}", "\\else", "  \\echo 'give -v operator=<uuid>'", "  \\quit", "\\endif",
             "\\set ON_ERROR_STOP on", "begin;", "select set_config('legacy.operator', :'operator', true);"]
    counts = {"fields": {}, "customers": 0, "solutions": 0, "organizations": 0, "audit_rows": 0, "skipped": []}

    for sid, item in sorted(checked.items()):
        record = records.get(sid)
        if not record or (not item["fields"] and not item["customers"]):
            continue
        org = record["org_id"]
        filled, evidence = [], {}
        touched_solution = touched_org = False
        for field, entry in item["fields"].items():
            value = entry["value"]
            if field == "summary":
                value = str(value).strip()[:280]
                update.append(f"update solution set summary = {lit(value)} where id = '{sid}' and (summary is null "
                              f"or summary = '' or summary like 'Company founded in %focusing on:%');")
                touched_solution = True
            elif field in SOLUTION_TEXT:
                update.append(f"update solution set {field} = {lit(str(value).strip())} where id = '{sid}' and "
                              f"({field} is null or {field} = '');")
                touched_solution = True
            elif field == "maturity" and value in MATURITY:
                update.append(f"update solution set maturity = {lit(value)} where id = '{sid}' and maturity is null;")
                touched_solution = True
            elif field in SOLUTION_ARRAYS and all(v in SOLUTION_ARRAYS[field] for v in value):
                update.append(f"update solution set {field} = {lit(list(dict.fromkeys(value)))} where id = '{sid}' "
                              f"and cardinality({field}) = 0;")
                touched_solution = True
            elif field == "country":
                update.append(f"update organization set country = {lit(value)} where id = '{org}' and country is null;")
                touched_org = True
            elif field == "founded_year":
                update.append(f"update organization set founded_year = {lit(int(value))} where id = '{org}' and "
                              f"founded_year is null;")
                touched_org = True
            elif field == "team_size" and value in TEAM_SIZE:
                update.append(f"update organization set team_size = {lit(value)} where id = '{org}' and team_size is "
                              f"null;")
                touched_org = True
            else:
                counts["skipped"].append(f"{sid} {field}")
                continue
            counts["fields"][field] = counts["fields"].get(field, 0) + 1
            filled.append(field)
            evidence[field] = {"quote": entry["quote"], "source": source_of(work, entry["source"])}
        for customer in item["customers"]:
            name = customer["name"].strip()[:200]
            quote = customer["quote"].strip()
            outcome = (customer.get("outcome") or "").strip()
            cid = uuid.uuid5(NAMESPACE, f"enrich-customer:{sid}:{name.lower()}")
            stage = "pilot" if PILOT.search(quote + " " + outcome) else "production"
            update.append(
                "insert into solution_customer_deployment (id, solution_id, title, customer, problem, delivered, stage, "
                "status, decided_at) "
                f"select '{cid}', '{sid}', {lit(name)}, {lit(name)}, {lit(outcome or quote)}, {lit(quote)}, '{stage}', "
                f"'approved', now() where not exists (select 1 from solution_customer_deployment where solution_id = "
                f"'{sid}' and lower(customer) = lower({lit(name)})) on conflict (id) do nothing;")
            counts["customers"] += 1
            evidence.setdefault("customers", []).append(
                {"name": name, "quote": quote, "source": source_of(work, customer["source"])})
        if item["customers"]:
            filled.append("customers")
            touched_solution = True
        counts["solutions"] += touched_solution
        counts["organizations"] += touched_org
        text = json.dumps(evidence, ensure_ascii=False)
        while len(text.encode("utf-8")) > 8000 and evidence.get("customers"):
            evidence["customers"].pop()
            text = json.dumps(evidence, ensure_ascii=False)
        eid = uuid.uuid5(NAMESPACE, f"enrich-audit:{sid}")
        details = json.dumps({"fields": ", ".join(filled), "evidence": text}, ensure_ascii=False)
        audit.append(
            "insert into audit_event (id, action, actor_id, actor_label, actor_email, resource_type, resource_id, "
            "resource_label, details) "
            f"select '{eid}', 'solution.enrich', a.id, a.email, a.email, 'solution', '{sid}', s.name, "
            f"{lit(details)}::jsonb from identity_account a join solution s on s.id = '{sid}' "
            "where a.id = current_setting('legacy.operator')::uuid "
            f"and not exists (select 1 from audit_event where id = '{eid}');")
        counts["audit_rows"] += 1

    update.append("commit;")
    audit.append("commit;")
    (out / "update.sql").write_text("\n".join(update) + "\n", encoding="utf-8")
    (out / "audit.sql").write_text("\n".join(audit) + "\n", encoding="utf-8")
    (out / "apply.json").write_text(json.dumps(counts, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in counts.items() if k != "skipped"}, indent=2), "skipped:", len(counts["skipped"]))


if __name__ == "__main__":
    main()
