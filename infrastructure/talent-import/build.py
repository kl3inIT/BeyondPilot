"""Builds the load of the registrations: one SQL file, for any environment.

    python build.py <registrations.xlsx> <output directory>

Writes `<output>/load.sql` and `<output>/build.json`. The SQL writes an account for each address that has none and a
hidden draft profile for each account that has none; run again, it adds only what is not there yet.
"""

import json
import sys
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))  # run with -I, so the folder is added explicitly

import records


def lit(value) -> str:
    return "null" if value is None else "'" + str(value).replace("'", "''") + "'"


def array(values) -> str:
    return "'{}'::text[]" if not values else "array[" + ", ".join(lit(v) for v in values) + "]::text[]"


HEAD = r"""-- The load of the Agentic AI Build Week registrations into talent profiles, built by
-- infrastructure/talent-import/build.py. Run after a dump:
--   psql -v ON_ERROR_STOP=1 -f load.sql
\set ON_ERROR_STOP on
begin;

create temp table aabw_person (
    email           text primary key,
    account_id      uuid not null,
    profile_id      uuid not null,
    project_id      uuid not null,
    slug            text not null,
    name            text not null,
    headline        text not null,
    bio             text not null,
    roles           text[] not null,
    skills          text[] not null,
    country         text,
    industries      text[] not null,
    works_at        text,
    website         text,
    project_title   text not null,
    project_summary text
) on commit drop;
"""

TAIL = r"""
-- In the order of the addresses, so a profile takes the same address suffix on every environment. An account that
-- exists is used as it is; a person who has a profile already keeps it untouched.
do $$
declare
    person record;
    account uuid;
    address text;
    suffix integer;
    accounts integer := 0;
    profiles integer := 0;
    kept integer := 0;
begin
    for person in select * from aabw_person order by email loop
        select id into account from identity_account where lower(identity_account.email) = person.email;
        if account is null then
            account := person.account_id;
            insert into identity_account (id, email) values (account, person.email);
            accounts := accounts + 1;
        end if;
        if exists (select 1 from talent_profile where account_id = account) then
            kept := kept + 1;
            continue;
        end if;
        -- An address taken already takes the next free number, as TalentService.freeSlug does.
        address := person.slug;
        suffix := 2;
        while exists (select 1 from talent_profile where slug = address) loop
            address := person.slug || '-' || suffix;
            suffix := suffix + 1;
        end loop;
        insert into talent_profile (id, account_id, slug, name, headline, bio, roles, skills, country, industries,
                                    works_at, website, status, listed)
        values (person.profile_id, account, address, person.name, person.headline, person.bio, person.roles,
                person.skills, person.country, person.industries, person.works_at, person.website, 'draft', false);
        insert into talent_project (id, profile_id, position, title, summary)
        values (person.project_id, person.profile_id, 0, person.project_title, person.project_summary);
        profiles := profiles + 1;
    end loop;
    raise notice 'aabw import: % people, % accounts created, % profiles written, % kept the profile they had',
        (select count(*) from aabw_person), accounts, profiles, kept;
end $$;
commit;
"""


def row(p: records.Profile) -> str:
    return ("(" + ", ".join([
        lit(p.email), lit(p.account_id), lit(p.id), lit(p.project_id), lit(p.slug), lit(p.name), lit(p.headline),
        lit(p.bio), array(p.roles), array(p.skills), lit(p.country), array(p.industries), lit(p.works_at),
        lit(p.website), lit(p.project.title), lit(p.project.summary)]) + ")")


def build(workbook_path: Path, out: Path) -> dict:
    read = records.read(openpyxl.load_workbook(workbook_path, read_only=True, data_only=True))
    if not read.profiles:
        raise SystemExit("No registration becomes a profile; nothing was written.")
    sql = HEAD + "\ninsert into aabw_person values\n" + ",\n".join(row(p) for p in read.profiles) + ";\n" + TAIL
    out.mkdir(parents=True, exist_ok=True)
    (out / "load.sql").write_text(sql, encoding="utf-8", newline="\n")
    result = {"rows": read.rows, "profiles": len(read.profiles), "left_out": dict(read.left_out)}
    (out / "build.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    return result


if __name__ == "__main__":
    print(json.dumps(build(Path(sys.argv[1]), Path(sys.argv[2])), indent=2, ensure_ascii=False))
