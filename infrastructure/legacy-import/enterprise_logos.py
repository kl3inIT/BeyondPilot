"""The logos of the old platform's enterprises, for the organizations that have none.

    python enterprise_logos.py <full-export.xlsx> <output directory> <cache directory>

Fetches each logo the `enterprises` sheet names, by the rules of `fetch.py`, and writes `<output>/logo-files/<object
key>`, the layout of the local object store, and `<output>/enterprise-logos.sql`. The SQL stores each file and names
it on the enterprise's organization when that has no logo; a file no organization took is removed again. It takes the
operator account as `-v operator=<uuid>`. Copy the files into the object store before running it.
"""

import collections
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))  # run with -I, so the folder is added explicitly

import build
import enterprises
import fetch
import mapping
import records
import report

PURPOSE = "organization_logo"


def logos(rows) -> list[tuple[records.Organization, records.File]]:
    """Each enterprise with a logo the load may fetch, and the file. A file two enterprises name goes to the first."""
    found, seen = [], set()
    for row in rows:
        organization = enterprises.profile(row)
        url = mapping.clean(row.get("logo"))
        if organization is None or not mapping.fetchable(url):
            continue
        file = records.File(mapping.source_url(url), PURPOSE)
        if file.id not in seen:
            seen.add(file.id)
            found.append((organization, file))
    return found


def sql(stored: list[tuple[records.Organization, dict]]) -> str:
    lines = ["-- The logos of the old platform's enterprises, built by infrastructure/legacy-import/enterprise_logos.py.",
             build.HEAD]
    for organization, row in stored:
        lines.append(
            "insert into storage_file (id, provider, object_key, purpose, public_read, file_name, media_type, "
            "size_bytes, status, uploaded_by_account_id, upload_expires_at, stored_at) "
            f"select {build.lit(str(row['id']))}, 'local', {build.lit(row['object_key'])}, {build.lit(PURPOSE)}, "
            f"{build.lit(row['public'])}, {build.lit(row['name'])}, {build.lit(row['type'])}, {row['size']}, 'stored', "
            "current_setting('legacy.operator')::uuid, now(), now() "
            f"where not exists (select 1 from storage_file where id = {build.lit(str(row['id']))});")
        lines.append(
            f"update organization set logo_file_id = {build.lit(str(row['id']))}, version = version + 1, "
            f"updated_at = now() where id = {build.lit(str(organization.id))} and logo_file_id is null;")
        lines.append(f"insert into legacy_ids (id) values ({build.lit(str(row['id']))});")
    # A file no organization took (it has a logo already, or is not here) is removed again, so nothing is left unnamed.
    lines.append("delete from storage_file f where f.id in (select id from legacy_ids) "
                 "and not exists (select 1 from organization o where o.logo_file_id = f.id);")
    lines.append("do $$ begin raise notice 'legacy import: % logos fetched, % named on an organization', "
                 "(select count(*) from legacy_ids), "
                 "(select count(*) from organization o join legacy_ids l on l.id = o.logo_file_id); end $$;")
    lines.append("commit;")
    return "\n".join(lines) + "\n"


def main(workbook_path: Path, out: Path, cache: Path) -> dict:
    rows = report.sheet(openpyxl.load_workbook(workbook_path, read_only=True, data_only=True), "enterprises")
    files_dir = out / "logo-files"
    if files_dir.exists():
        shutil.rmtree(files_dir)
    month = datetime.now(timezone.utc).strftime("%Y/%m")
    refused = collections.Counter()
    stored = []
    named = sum(1 for row in rows if mapping.clean(row.get("logo")))
    wanted = logos(rows)
    for organization, file in wanted:
        try:
            got = fetch.fetch(file.url, PURPOSE, None, cache)
        except (ValueError, RuntimeError) as reason:
            refused[str(reason)] += 1
            continue
        object_key = f"{PURPOSE}/{month}/{file.id}"
        target = files_dir / object_key
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(got.path, target)
        stored.append((organization, {"id": file.id, "object_key": object_key, "public": fetch.PURPOSES[PURPOSE][2],
                                      "name": got.file_name, "type": got.media_type, "size": got.size}))
    out.mkdir(parents=True, exist_ok=True)
    (out / "enterprise-logos.sql").write_text(sql(stored), encoding="utf-8", newline="\n")
    return {"enterprises_naming_a_logo": named, "not_an_address_the_load_fetches": named - len(wanted),
            "fetched": len(stored), "refused": dict(refused), "bytes": sum(row["size"] for _, row in stored)}


if __name__ == "__main__":
    print(json.dumps(main(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])), indent=2, ensure_ascii=False))
