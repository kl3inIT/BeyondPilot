"""Builds the load of the old platform's export: one SQL file and the files it names, for any environment.

    python build.py <export.xlsx> <output directory> <cache directory>

Writes `<output>/load.sql` and `<output>/files/<object key>`, the layout of the local object store, and prints what was
fetched and what was refused. The SQL takes the operator account of the target environment as `-v operator=<uuid>`.
"""

import collections
import json
import re
import shutil
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))  # run with -I, so the folder is added explicitly

import fetch
import records


def slug(name: str, fallback: str) -> str:
    """As OrganizationViews.slug and SolutionViews.slug make it."""
    text = unicodedata.normalize("NFD", name)
    text = "".join(c for c in text if not unicodedata.combining(c)).replace("đ", "d").replace("Đ", "D").lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    if not text:
        return fallback
    return text[:60].rstrip("-") if len(text) > 60 else text


def lit(value) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, datetime):
        return "'" + value.astimezone(timezone.utc).isoformat() + "'::timestamptz"
    return "'" + str(value).replace("'", "''") + "'"


def array(values) -> str:
    return "'{}'::text[]" if not values else "array[" + ", ".join(lit(v) for v in values) + "]::text[]"


HEAD = r"""-- The load of the old platform's export into BeyondPilot, built by infrastructure/legacy-import/build.py.
-- Run once per environment, after a dump, with the files already in the object store:
--   psql -v ON_ERROR_STOP=1 -v operator=<operator account uuid> -f load.sql
\if :{?operator}
\else
  \echo 'legacy import: give the operator account of this environment with -v operator=<uuid>'
  \quit
\endif
\set ON_ERROR_STOP on
begin;
select set_config('legacy.operator', :'operator', true);

do $$
begin
    if not exists (select 1 from identity_account
                   where id = current_setting('legacy.operator')::uuid and platform_role = 'operator'
                     and status = 'active') then
        raise exception 'legacy import: % is not an active operator account', current_setting('legacy.operator');
    end if;
end $$;

-- An address taken already, or by an earlier row of this load, takes the next free number, as the backend does.
create function pg_temp.free_slug(kind text, base text) returns text language plpgsql as $$
declare
    candidate text := base;
    suffix integer := 2;
    taken boolean;
begin
    loop
        execute format('select exists (select 1 from %I where slug = $1)', kind) into taken using candidate;
        exit when not taken;
        candidate := base || '-' || suffix;
        suffix := suffix + 1;
    end loop;
    return candidate;
end $$;

create temp table legacy_ids (id uuid primary key) on commit drop;
"""


def v1_details_sql(data: records.Records) -> str:
    """Refresh only the v1 detail fields on deterministic startup rows an older load already created."""
    organizations = {organization.id: organization for organization in data.organizations}
    statements = [
        "-- Refresh v1 startup detail fields after V56 and V57, without repeating the one-off load.",
        "-- This changes only the imported company-size label and solution detail columns.",
        "begin;",
    ]
    refreshed_organizations = set()
    for solution in data.solutions:
        organization = organizations[solution.organization_id]
        if organization.id not in refreshed_organizations:
            statements.append(
                f"update organization set company_size_label = {lit(organization.company_size_label)} "
                f"where id = {lit(str(organization.id))};")
            refreshed_organizations.add(organization.id)
        statements.append(
            "update solution set "
            f"traction = {lit(solution.traction)}, "
            f"product_names = {array(solution.product_names)}, "
            f"core_technology = {lit(solution.core_technology)}, "
            f"infrastructure_used = {lit(solution.infrastructure_used)}, "
            f"segment_focus = {array(solution.segment_focus)}, "
            f"notable_paying_customers = {lit(solution.notable_paying_customers)}, "
            f"use_case_industries = {array(solution.use_case_industries)}, "
            f"use_case_descriptions = {lit(solution.use_case_descriptions)}, "
            f"monetization_model = {lit(solution.monetization_model)}, "
            f"company_funding_status = {lit(solution.company_funding_status)}, "
            f"company_funding_raised = {lit(solution.company_funding_raised)}, "
            f"competitors = {lit(solution.competitors)}, "
            f"built_with = {array(solution.built_with)} "
            f"where id = {lit(str(solution.id))};")
    statements.append("commit;")
    return "\n".join(statements)


def build(workbook_path: Path, out: Path, cache: Path) -> dict:
    data = records.read(openpyxl.load_workbook(workbook_path, read_only=True))
    files_dir = out / "files"
    if files_dir.exists():
        shutil.rmtree(files_dir)
    month = datetime.now(timezone.utc).strftime("%Y/%m")
    tally = collections.Counter()
    refused = collections.Counter()
    stored: dict = {}
    total_bytes = 0

    def store(file: records.File | None):
        nonlocal total_bytes
        if file is None:
            return None
        key = (file.purpose, file.url)
        if key in stored:
            return stored[key]
        try:
            got = fetch.fetch(file.url, file.purpose, file.name, cache)
        except ValueError as reason:
            refused[f"{file.purpose}: {reason}"] += 1
            stored[key] = None
            return None
        except RuntimeError as reason:
            refused[f"{file.purpose}: {reason}"] += 1
            stored[key] = None
            return None
        object_key = f"{file.purpose}/{month}/{file.id}"
        target = files_dir / object_key
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(got.path, target)
        tally[file.purpose] += 1
        total_bytes += got.size
        row = {"id": file.id, "object_key": object_key, "purpose": file.purpose,
               "public": fetch.PURPOSES[file.purpose][2], "name": got.file_name, "type": got.media_type,
               "size": got.size, "first": True}
        stored[key] = row
        return row

    sql = [HEAD]
    used_files: set = set()

    def file_row(row) -> str:
        return ("insert into storage_file (id, provider, object_key, purpose, public_read, file_name, media_type, "
                "size_bytes, status, uploaded_by_account_id, upload_expires_at, stored_at) values ("
                f"{lit(str(row['id']))}, 'local', {lit(row['object_key'])}, {lit(row['purpose'])}, {lit(row['public'])}, "
                f"{lit(row['name'])}, {lit(row['type'])}, {row['size']}, 'stored', "
                "current_setting('legacy.operator')::uuid, now(), now());")

    def claim(row):
        """A file a record names; a file another record took first is left off this one (each is named once)."""
        if row is None or row["id"] in used_files:
            return None
        used_files.add(row["id"])
        sql.append(file_row(row))
        return row

    ids = [o.id for o in data.organizations] + [s.id for s in data.solutions] + [u.id for u in data.use_cases]
    sql.append("insert into legacy_ids (id) values\n" + ",\n".join(f"({lit(str(i))})" for i in ids) + ";")
    sql.append("""do $$
begin
    if exists (select 1 from legacy_ids l where l.id in (select id from organization union all select id from solution
                                                     union all select id from use_case)) then
        raise exception 'legacy import: this export is loaded already; nothing was changed';
    end if;
end $$;
""")

    for i, organization in enumerate(data.organizations, 1):
        logo = claim(store(organization.logo))
        sql.append(
            "insert into organization (id, slug, name, type, website, country, team_size, company_size_label, "
            "description, auto_join, status, created_by_account_id, industries, founded_year, logo_file_id) values ("
            f"{lit(str(organization.id))}, pg_temp.free_slug('organization', {lit(slug(organization.name, 'organization'))}), "
            f"{lit(organization.name)}, 'company', {lit(organization.website)}, {lit(organization.country)}, "
            f"{lit(organization.team_size)}, {lit(organization.company_size_label)}, {lit(organization.description)}, "
            f"false, 'in_review', current_setting('legacy.operator')::uuid, {array(organization.industries)}, "
            f"{lit(organization.founded_year)}, {lit(str(logo['id'])) if logo else 'null'});")
        if i % 200 == 0:
            print(f"organizations {i}/{len(data.organizations)}", flush=True)

    for i, solution in enumerate(data.solutions, 1):
        deck = next((row for row in (claim(store(file)) for file in solution.decks) if row), None)
        submitted = "now()" if solution.status == "in_review" else "null"
        sql.append(
            "insert into solution (id, organization_id, slug, name, summary, problems_solved, value_proposition, "
            "focus_areas, industries, maturity, deployment, website, status, listed, created_by_account_id, "
            "submitted_at, best_customer_profile, traction, product_names, core_technology, infrastructure_used, "
            "segment_focus, notable_paying_customers, use_case_industries, use_case_descriptions, monetization_model, "
            "company_funding_status, company_funding_raised, competitors, built_with, demo_url, deck_file_id, "
            "deck_file_name, deck_size_bytes, deck_attached_at) values ("
            f"{lit(str(solution.id))}, {lit(str(solution.organization_id))}, "
            f"pg_temp.free_slug('solution', {lit(slug(solution.name, 'solution'))}), {lit(solution.name)}, "
            f"{lit(solution.summary)}, {lit(solution.problems_solved)}, {lit(solution.value_proposition)}, "
            f"{array(solution.focus_areas)}, {array(solution.industries)}, {lit(solution.maturity)}, "
            f"{array(solution.deployment)}, {lit(solution.website)}, {lit(solution.status)}, false, "
            f"current_setting('legacy.operator')::uuid, {submitted}, {lit(solution.best_customer_profile)}, "
            f"{lit(solution.traction)}, {array(solution.product_names)}, {lit(solution.core_technology)}, "
            f"{lit(solution.infrastructure_used)}, {array(solution.segment_focus)}, "
            f"{lit(solution.notable_paying_customers)}, {array(solution.use_case_industries)}, "
            f"{lit(solution.use_case_descriptions)}, {lit(solution.monetization_model)}, "
            f"{lit(solution.company_funding_status)}, {lit(solution.company_funding_raised)}, "
            f"{lit(solution.competitors)}, {array(solution.built_with)}, {lit(solution.demo_url)}, "
            + (f"{lit(str(deck['id']))}, {lit(deck['name'])}, {deck['size']}, now());" if deck
               else "null, null, null, null);"))
        if i % 200 == 0:
            print(f"solutions {i}/{len(data.solutions)}", flush=True)

    programs = sorted({p for u in data.use_cases for p in u.programs})
    new_program = records.ident("program", "Nestlé Vietnam AI Reinvention")
    sql.append(
        "insert into program (id, slug, name, type, partner_name, status) "
        f"select {lit(str(new_program))}, pg_temp.free_slug('program', 'nestle-vietnam-ai-reinvention'), "
        "'Nestlé Vietnam AI Reinvention', 'enterprise_challenge', 'Nestlé Vietnam', 'draft' "
        "where not exists (select 1 from program where lower(name) = lower('Nestlé Vietnam AI Reinvention'));")

    links = 0
    for use_case in data.use_cases:
        s = use_case.sections
        sql.append(
            "insert into use_case (id, organization_id, title, problem_statement, industry, technologies, "
            "expected_outcomes, current_solutions, target_users, data_readiness, integration_requirements, currency, "
            "budget_min, budget_max, budget_to_be_determined, hide_organization_name, status, closes_at, "
            "created_by_account_id, last_edited_by_account_id) values ("
            f"{lit(str(use_case.id))}, {lit(str(use_case.organization_id))}, {lit(use_case.title)}, "
            f"{lit(s['problem_statement'])}, {lit(use_case.industry)}, {array(use_case.technologies)}, "
            f"{lit(s['expected_outcomes'])}, {lit(s['current_solutions'])}, {lit(s['target_users'])}, "
            f"{lit(s['data_readiness'])}, {lit(s['integration_requirements'])}, {lit(use_case.currency)}, "
            f"{lit(use_case.budget_min)}, {lit(use_case.budget_max)}, {lit(use_case.budget_to_be_determined)}, "
            f"{lit(use_case.hide_organization_name)}, 'draft', {lit(use_case.closes_at)}, "
            "current_setting('legacy.operator')::uuid, current_setting('legacy.operator')::uuid);")
        for program in use_case.programs:
            links += 1
            sql.append(
                "insert into use_case_program (use_case_id, program_id) "
                f"select {lit(str(use_case.id))}, p.id from program p where lower(p.name) = lower({lit(program)}) "
                "order by p.created_at limit 1;")
        position = 0
        for attachment in use_case.attachments:
            row = claim(store(attachment))
            if row:
                sql.append(f"insert into use_case_attachment (use_case_id, position, file_id) values "
                           f"({lit(str(use_case.id))}, {position}, {lit(str(row['id']))});")
                position += 1

    sql.append(f"""do $$
declare
    linked integer;
begin
    select count(*) into linked from use_case_program where use_case_id in (select id from legacy_ids);
    raise notice 'legacy import: % organizations, % solutions, % use cases, % program links of {links} named, % files',
        (select count(*) from organization where id in (select id from legacy_ids)),
        (select count(*) from solution where id in (select id from legacy_ids)),
        (select count(*) from use_case where id in (select id from legacy_ids)),
        linked,
        (select count(*) from storage_file where id in ({", ".join(lit(str(i)) for i in used_files) or "null"}));
end $$;
commit;
""")
    out.mkdir(parents=True, exist_ok=True)
    (out / "load.sql").write_text("\n".join(sql), encoding="utf-8")
    (out / "v1-details.sql").write_text(v1_details_sql(data), encoding="utf-8")
    result = {
        "organizations": len(data.organizations), "solutions": len(data.solutions), "use_cases": len(data.use_cases),
        "programs_named": programs, "program_links": links, "files_stored": dict(tally),
        "files_refused": dict(refused), "bytes": total_bytes, "left_out": data.left_out,
    }
    (out / "build.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    return result


if __name__ == "__main__":
    print(json.dumps(build(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])), indent=2, ensure_ascii=False))
