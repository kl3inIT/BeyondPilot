"""Approve and list on staging what load.sql imported, so matching can be built on real data.

Staging only: production keeps the import in review until GenAI Fund decides (design, decision 3). The script
reads the ids from load.sql, so it touches nothing the load did not create.

    python -I staging_list.py ../../.tmp/legacy-import/out/load.sql > ../../.tmp/legacy-import/out/staging-list.sql
"""

import re
import sys

ID = re.compile(r"values \('([0-9a-f-]{36})'")


def ids(sql: str, table: str) -> list[str]:
    prefix = f"insert into {table} ("
    return [m.group(1) for line in sql.splitlines() if line.startswith(prefix) for m in [ID.search(line)] if m]


def values(found: list[str]) -> str:
    return ",\n    ".join(f"('{i}'::uuid)" for i in found)


def main() -> None:
    sql = open(sys.argv[1], encoding="utf-8").read()
    organizations = ids(sql, "organization")
    solutions = ids(sql, "solution")
    print(f"""-- Staging only: approve the imported organizations, then approve and list every imported solution, active or
-- not. Run after load.sql, then rebuild the search index.
\\set ON_ERROR_STOP on
begin;

update organization o set status = 'approved', decided_at = now()
from (values
    {values(organizations)}) imported(id)
where o.id = imported.id and o.status = 'in_review';

update solution s set status = 'approved', listed = true, decided_at = now()
from (values
    {values(solutions)}) imported(id)
where s.id = imported.id and s.status in ('in_review', 'draft');

commit;""")


if __name__ == "__main__":
    main()
