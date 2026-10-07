"""Load the logos and covers that enrichment found into an environment's object store and database.

Reads fetch.json from the enrichment fetch, copies each chosen image into the local object store's layout and writes
images.sql: one transaction that stores the files and names them on the records that have none yet (a logo on the
organization, a cover on the solution). A record that has an image already keeps it.

    python -I enrich_images.py <fetch.json folder> <out folder>
    psql -v ON_ERROR_STOP=1 -v operator=<operator account uuid> -f images.sql
"""

import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # run with -I, so the folder is added explicitly

import records
from build import lit

TYPES = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}
LIMIT = 5 * 1024 * 1024  # organization_logo and solution_image, StorageProperties

HEADER = """-- Images found by enrichment, built by infrastructure/legacy-import/enrich_images.py.
\\if :{?operator}
\\else
  \\echo 'enrichment images: give the operator account of this environment with -v operator=<uuid>'
  \\quit
\\endif
\\set ON_ERROR_STOP on
begin;
select set_config('legacy.operator', :'operator', true);

do $$
begin
    if not exists (select 1 from identity_account
                   where id = current_setting('legacy.operator')::uuid and platform_role = 'operator'
                     and status = 'active') then
        raise exception 'enrichment images: % is not an active operator account', current_setting('legacy.operator');
    end if;
end $$;
"""


def main() -> None:
    work, out = Path(sys.argv[1]), Path(sys.argv[2])
    entries = json.loads((work / "fetch.json").read_text(encoding="utf-8"))
    files_dir = out / "files"
    if files_dir.exists():
        shutil.rmtree(files_dir)
    month = datetime.now(timezone.utc).strftime("%Y/%m")
    sql, ids, skipped = [HEADER], [], {}
    counts = {"organization_logo": 0, "solution_image": 0}

    def stage(image: dict, purpose: str, key: str, name: str):
        source = work / image["file"]
        media = TYPES.get(source.suffix.lower())
        if media is None or not source.is_file():
            skipped[f"{purpose}: not a png, jpeg or webp file"] = skipped.get(f"{purpose}: not a png, jpeg or webp file", 0) + 1
            return None
        size = source.stat().st_size
        if size > LIMIT or size == 0:
            skipped[f"{purpose}: over 5 MB or empty"] = skipped.get(f"{purpose}: over 5 MB or empty", 0) + 1
            return None
        file_id = records.ident("enrich-" + purpose, key)
        object_key = f"{purpose}/{month}/{file_id}"
        target = files_dir / object_key
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        sql.append("insert into storage_file (id, provider, object_key, purpose, public_read, file_name, media_type, "
                   "size_bytes, status, uploaded_by_account_id, upload_expires_at, stored_at) values ("
                   f"{lit(str(file_id))}, 'local', {lit(object_key)}, {lit(purpose)}, true, "
                   f"{lit(name + source.suffix.lower())}, {lit(media)}, {size}, 'stored', "
                   "current_setting('legacy.operator')::uuid, now(), now());")
        ids.append(str(file_id))
        counts[purpose] += 1
        return file_id

    seen_orgs = set()
    for entry in entries:
        logo, cover = entry.get("logo"), entry.get("cover")
        if logo and entry["org_id"] not in seen_orgs:
            seen_orgs.add(entry["org_id"])
            file_id = stage(logo, "organization_logo", entry["org_id"], "logo")
            if file_id:
                sql.append(f"update organization set logo_file_id = {lit(str(file_id))} "
                           f"where id = {lit(entry['org_id'])} and logo_file_id is null;")
        if cover:
            file_id = stage(cover, "solution_image", entry["id"], "cover")
            if file_id:
                sql.append(f"update solution set cover_file_id = {lit(str(file_id))} "
                           f"where id = {lit(entry['id'])} and cover_file_id is null;")

    # A file no record took (the record had an image already) is removed again, so nothing is left unnamed.
    sql.append("delete from storage_file f where f.id in (" + ", ".join(lit(i) for i in ids) + ") "
               "and not exists (select 1 from organization o where o.logo_file_id = f.id) "
               "and not exists (select 1 from solution s where s.cover_file_id = f.id);")
    sql.append("do $$ begin raise notice 'enrichment images: % logos, % covers named', "
               "(select count(*) from organization o join storage_file f on f.id = o.logo_file_id "
               "where f.object_key like 'organization_logo/%' and f.file_name like 'logo.%'), "
               "(select count(*) from solution s join storage_file f on f.id = s.cover_file_id "
               "where f.file_name like 'cover.%'); end $$;")
    sql.append("commit;")
    (out / "images.sql").write_text("\n".join(sql) + "\n", encoding="utf-8")
    print(json.dumps({"staged": counts, "skipped": skipped}, indent=1))


if __name__ == "__main__":
    main()
