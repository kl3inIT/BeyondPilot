"""Builds the load of the Tasco challenge applications kept by the Lovable page into BeyondPilot (BEY-131).

    python -I build.py <export directory> <output directory>

The export directory holds `applications.csv` (the `applications` table, semicolon separated), `exclude.json` (the
identifiers of the test applications) and `files/<path of the file in the pitch-decks bucket>`.

Writes `<output>/load.sql`, `<output>/storage/<object key>` for every file, and `<output>/build.json` with counts and
no personal data. The SQL writes, for each applicant: the account when the address has none, the organization when the
account is in none, the solution, the files and the application, with the version a submission keeps. Run again, it
adds only the applicants who have no application to the program yet. It publishes no event, so no email is sent.
"""

import collections
import csv
import json
import re
import shutil
import sys
import unicodedata
import uuid
from pathlib import Path

NAMESPACE = uuid.UUID("5d0c2f6e-3b1a-4c8d-9e27-7a4b1c9d2e63")
PROGRAM = "insurance-ai-tasco"
OBJECT_MONTH = "2026/10"

# The program question each Lovable field answers, by the question's label; a field whose question the program does
# not ask is left out by the load.
PROPOSAL_FILE = "Your proposal to Tasco"
TEXT_ANSWERS = {
    "proposal_description": "How does your solution address the challenge?",
    "pilot_requirements": "What would Tasco need to provide for a pilot?",
}

COUNTRY = {
    "Australia": "AU", "Cambodia": "KH", "China": "CN", "Denmark": "DK", "Hong Kong": "HK", "India": "IN",
    "Indonesia": "ID", "Japan": "JP", "Malaysia": "MY", "Singapore": "SG", "Taiwan": "TW", "Thailand": "TH",
    "United Arab Emirates": "AE", "United States": "US", "Vietnam": "VN", "Philippines": "PH", "South Korea": "KR",
    "United Kingdom": "GB", "Germany": "DE", "France": "FR", "Canada": "CA", "Algeria": "DZ", "Albania": "AL",
}
TEAM_SIZE = {
    "Just me": "just_me", "2–9": "2_9", "10–49": "10_49", "50–99": "50_99", "100–499": "100_499",
    "500–999": "500_999", "1,000–4,999": "1000_4999", "5,000+": "5000_plus",
}
MATURITY = {
    "Idea / Concept": "idea", "Prototype / MVP": "prototype", "Live PoC": "pilot", "Pilot Deployment": "pilot",
    "Beta Release": "pilot", "Production / Live": "production", "Scaled / Growth": "scaled",
}
COMPANY_TYPES = {"Start-up", "Small-Medium Business", "Enterprise"}
KNOWN_TYPES = COMPANY_TYPES | {
    "Self Employed", "Education", "Others", "Other organization", "Government - Federal", "Government - State",
    "Government - Local", "Non-profit", "Student",
}

# What makes a row an application: a row with none of these is an account that opened the form and wrote nothing.
CONTENT = ("team_name", "first_name", "last_name", "phone", "solution_name", "team_background", "pain_points",
           "pitch_deck", "proposal_pdf", "solution_summary", "proposal_description", "pilot_requirements")


def ident(kind: str, key: str) -> str:
    return str(uuid.uuid5(NAMESPACE, f"{kind}:{key}"))


def clean(value: str | None) -> str | None:
    text = (value or "").strip()
    return text or None


def slug(name: str) -> str:
    text = unicodedata.normalize("NFD", name)
    text = "".join(c for c in text if not unicodedata.combining(c)).replace("đ", "d").replace("Đ", "D").lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text[:60].rstrip("-")


def link(value: str | None, https_only: bool = False) -> str | None:
    text = clean(value)
    if text is None or re.search(r"\s", text):
        return None
    if not re.match(r"^https?://", text, re.I):
        text = "https://" + text
    if https_only:
        text = re.sub(r"^http://", "https://", text, flags=re.I)
    return text if len(text) <= 300 else None


def lit(value) -> str:
    return "null" if value is None else "'" + str(value).replace("'", "''") + "'"


def array(values) -> str:
    return "'{}'::text[]" if not values else "array[" + ", ".join(lit(v) for v in values) + "]::text[]"


def build(export: Path, out: Path) -> dict:
    with open(export / "applications.csv", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle, delimiter=";"))
    excluded = set(json.loads((export / "exclude.json").read_text(encoding="utf-8"))["excluded_as_tests"])
    counts: collections.Counter = collections.Counter()
    unknown: dict[str, set] = collections.defaultdict(set)
    apps, files, answers = [], [], []
    storage = out / "storage"
    if storage.exists():
        shutil.rmtree(storage)

    for row in sorted(rows, key=lambda r: r["email"].strip().lower()):
        counts["rows"] += 1
        if row["id"] in excluded:
            counts["left out: test application"] += 1
            continue
        if not any(clean(row[k]) for k in CONTENT):
            counts["left out: nothing written"] += 1
            continue
        key = row["id"]
        email = row["email"].strip().lower()

        def known(table: dict, column: str):
            value = clean(row[column])
            if value is not None and value not in table:
                unknown[column].add(value)
            return table.get(value or "")

        country = known(COUNTRY, "country")
        business_country = known(COUNTRY, "business_country") or country
        team_size = known(TEAM_SIZE, "org_size")
        maturity = known(MATURITY, "product_stage")
        types = [t.strip() for t in (row["participant_type"] or "").split(";") if t.strip()]
        for stated in types:
            if stated not in KNOWN_TYPES:
                unknown["participant_type"].add(stated)
        if team_size == "just_me" or types == ["Self Employed"]:
            organization_type, team_size = "independent_builder", "just_me"
        elif COMPANY_TYPES & set(types):
            organization_type = "company"
        else:
            organization_type = "other"

        phone = clean(row["phone"])
        if phone is not None and not phone.startswith("+"):
            code = (row["phone_country_code"] or "").partition("|")[2].strip()
            phone = f"{code} {phone}".strip()
        if phone is not None and (len(phone) > 40 or not re.match(r"^\+?[0-9 ().-]*$", phone)):
            counts["phone not usable, left empty"] += 1
            phone = None

        first, last = clean(row["first_name"]), clean(row["last_name"])
        contact = {"firstName": first, "lastName": last, "phone": phone, "country": country,
                   "linkedin": link(row["linkedin_url"], https_only=True)}
        built_with = [str(v).strip() for v in json.loads(row["built_with"] or "[]") if str(v).strip()]
        organization_name = clean(row["team_name"])
        solution_name = clean(row["solution_name"])
        if solution_name is not None and len(solution_name) > 120:
            solution_name = solution_name[:119].rstrip() + "…"
            counts["solution name shortened to 120"] += 1
        summary = clean(row["solution_summary"])
        if summary is not None and len(summary) > 600:
            counts["solution summary longer than the form takes (kept whole)"] += 1
        for column, limit in (("milestones_traction", 600), ("team_background", 2000)):
            if len(row[column].strip()) > limit:
                counts[f"{column} longer than the form takes (kept whole)"] += 1

        status = row["status"].strip()
        if status not in ("draft", "submitted"):
            unknown["status"].add(status)
        submitted_at = clean(row["first_submitted_at"]) if status == "submitted" else None
        if status == "submitted" and (submitted_at is None or organization_name is None or solution_name is None):
            status, submitted_at = "draft", None
            counts["submitted without an organization or a solution, loaded as a draft"] += 1
        counts[f"applications: {status}"] += 1

        file_ids = {}
        for column, kind in (("pitch_deck", "deck"), ("proposal_pdf", "proposal")):
            if not clean(row[column]):
                continue
            stated = json.loads(row[column])
            # The path comes from the export: a file outside its files folder is never read.
            files_root = (export / "files").resolve()
            source = (files_root / stated["path"]).resolve()
            if not source.is_relative_to(files_root):
                raise SystemExit(f"A {kind} path leaves the export's files folder; nothing was written.")
            if not source.is_file() or source.stat().st_size == 0 or not stated["name"].lower().endswith(".pdf"):
                counts[f"{kind} file not usable, left out"] += 1
                continue
            file_id = ident(f"file:{kind}", key)
            object_key = f"application_file/{OBJECT_MONTH}/{file_id}"
            target = storage / object_key
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            files.append((file_id, key, kind, object_key, stated["name"][:200], source.stat().st_size))
            file_ids[kind] = file_id
            counts[f"files: {kind}"] += 1

        for column, label in TEXT_ANSWERS.items():
            value = clean(row[column])
            if value is not None:
                answers.append((key, label, value[:4000]))

        apps.append("(" + ", ".join([
            lit(key), lit(email), lit(ident("account", email)), lit(ident("organization", key)),
            lit(ident("solution", key)), lit(ident("proposal", key)),
            lit(" ".join(p for p in (first, last) if p) or None), lit(country), lit(phone),
            lit(json.dumps(contact, ensure_ascii=False)) + "::jsonb",
            lit(organization_name), lit(slug(organization_name or "") or "team"), lit(organization_type),
            lit(team_size), lit(link(row["company_website"])), lit(business_country),
            lit(solution_name), lit(slug(solution_name or "") or "solution"), lit(summary),
            lit(clean(row["pain_points"])), lit(maturity), lit(link(row["video_demo_url"])),
            array(built_with), array([v[:40] for v in built_with[:10]]),
            lit(clean(row["team_background"])), lit(clean(row["milestones_traction"])),
            lit(file_ids.get("deck")), lit(file_ids.get("proposal")), lit(status),
            lit(submitted_at) + "::timestamptz", lit(row["created_at"]) + "::timestamptz",
            lit(row["updated_at"]) + "::timestamptz"]) + ")")

    if any(unknown.values()):
        raise SystemExit("Values this script has no mapping for: "
                         + json.dumps({k: sorted(v) for k, v in unknown.items() if v}, ensure_ascii=False))
    if not apps:
        raise SystemExit("No application to load; nothing was written.")

    sql = HEAD
    sql += "\ninsert into lov_app values\n" + ",\n".join(apps) + ";\n"
    if files:
        sql += "\ninsert into lov_file values\n" + ",\n".join(
            "(" + ", ".join([lit(f[0]), lit(f[1]), lit(f[2]), lit(f[3]), lit(f[4]), str(f[5])]) + ")"
            for f in files) + ";\n"
    if answers:
        sql += "\ninsert into lov_answer values\n" + ",\n".join(
            "(" + ", ".join(lit(v) for v in a) + ")" for a in answers) + ";\n"
    sql += TAIL.replace("@PROGRAM@", PROGRAM).replace("@PROPOSAL_FILE@", PROPOSAL_FILE)
    out.mkdir(parents=True, exist_ok=True)
    (out / "load.sql").write_text(sql, encoding="utf-8", newline="\n")
    result = dict(sorted(counts.items()))
    (out / "build.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    return result


HEAD = r"""-- The load of the Lovable page's Tasco applications, built by infrastructure/lovable-import/build.py. Run after a dump:
--   psql -v ON_ERROR_STOP=1 -f load.sql
\set ON_ERROR_STOP on
begin;

create temp table lov_app (
    key               text primary key,
    email             text not null unique,
    account_id        uuid not null,
    organization_id   uuid not null,
    solution_id       uuid not null,
    proposal_id       uuid not null,
    display_name      text,
    country           text,
    phone             text,
    contact           jsonb not null,
    organization_name text,
    organization_slug text not null,
    organization_type text not null,
    team_size         text,
    website           text,
    business_country  text,
    solution_name     text,
    solution_slug     text not null,
    summary           text,
    problems_solved   text,
    maturity          text,
    demo_url          text,
    built_with        text[] not null,
    solution_built    text[] not null,
    team_background   text,
    traction          text,
    deck_file_id      uuid,
    proposal_file_id  uuid,
    status            text not null,
    submitted_at      timestamptz,
    created_at        timestamptz not null,
    updated_at        timestamptz not null
) on commit drop;

create temp table lov_file (
    id         uuid primary key,
    key        text not null,
    kind       text not null,
    object_key text not null,
    file_name  text not null,
    size_bytes bigint not null
) on commit drop;

create temp table lov_answer (
    key   text not null,
    label text not null,
    value text not null
) on commit drop;
"""

TAIL = r"""

-- What ProposalService.snapshot keeps at a submission.
create function pg_temp.lov_version(key_ text, program_id_ uuid, organization_ uuid, solution_ uuid, answers_ jsonb)
returns void language plpgsql as $f$
declare
    app lov_app%rowtype;
begin
    select * into strict app from lov_app where key = key_;
    insert into proposal_version (proposal_id, number, submitted_at, snapshot)
    select app.proposal_id, 1, app.submitted_at, jsonb_build_object(
        'applicant', jsonb_build_object('email', app.email, 'contact', app.contact),
        'organization', jsonb_build_object('id', o.id, 'name', o.name, 'type', o.type, 'country', o.country,
            'teamSize', o.team_size, 'website', o.website, 'teamBackground', app.team_background),
        'solution', jsonb_build_object('id', s.id, 'name', s.name, 'summary', s.summary,
            'problemsSolved', s.problems_solved, 'maturity', s.maturity, 'demoUrl', s.demo_url),
        'materials', jsonb_build_object(
            'deck', (select jsonb_build_object('fileId', f.id, 'fileName', f.file_name,
                                               'sizeBytes', f.size_bytes)
                     from lov_file f where f.id = app.deck_file_id),
            'builtWith', to_jsonb(app.built_with), 'traction', app.traction),
        'answers', coalesce((
            select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                       'questionId', q.id, 'label', q.label, 'kind', q.kind, 'value', answers_ ->> q.id::text,
                       'file', (select jsonb_build_object('fileId', f.id, 'fileName', f.file_name,
                                                          'sizeBytes', f.size_bytes)
                                from lov_file f where q.kind = 'file'
                                    and f.id::text = answers_ ->> q.id::text))) order by q.position)
            from program_question q
            where q.program_id = program_id_ and answers_ ? q.id::text), '[]'::jsonb))
    from organization o, solution s where o.id = organization_ and s.id = solution_;
end $f$;

-- Brings one application loaded before up to date with the old page: its organization and solution (the ones this load
-- made), its files, its answers, and for a submitted one the version it keeps.
create function pg_temp.lov_update(key_ text, program_id_ uuid, account uuid, organization_ uuid) returns void
language plpgsql as $f$
declare
    app lov_app%rowtype;
    solution_ uuid;
    address text;
    suffix integer;
    answers_ jsonb;
begin
    select * into strict app from lov_app where key = key_;
    update organization set name = coalesce(app.organization_name, name), type = app.organization_type,
           website = app.website, country = app.business_country, team_size = app.team_size, updated_at = now()
    where id = organization_ and id = app.organization_id;

    select solution_id into solution_ from proposal where id = app.proposal_id;
    if solution_ is null and app.solution_name is not null then
        solution_ := app.solution_id;
        address := app.solution_slug;
        suffix := 2;
        while exists (select 1 from solution where slug = address) loop
            address := app.solution_slug || '-' || suffix;
            suffix := suffix + 1;
        end loop;
        insert into solution (id, organization_id, slug, name, summary, problems_solved, maturity, demo_url,
                              built_with, status, listed, created_by_account_id, created_at, updated_at)
        values (solution_, organization_, address, app.solution_name, app.summary, app.problems_solved,
                app.maturity, app.demo_url, app.solution_built, 'draft', true, account, app.created_at, app.updated_at);
    elsif solution_ is not null then
        update solution set name = coalesce(app.solution_name, name), summary = app.summary,
               problems_solved = app.problems_solved, maturity = app.maturity, demo_url = app.demo_url,
               built_with = app.solution_built, updated_at = app.updated_at
        where id = solution_;
    end if;

    -- A file replaced on the old page keeps its identifier: the row follows the new name and size.
    insert into storage_file (id, provider, object_key, purpose, public_read, file_name, media_type, size_bytes,
                              status, uploaded_by_account_id, upload_expires_at, created_at, stored_at)
    select f.id, 'local', f.object_key, 'application_file', false, f.file_name, 'application/pdf', f.size_bytes,
           'stored', account, now(), now(), now()
    from lov_file f where f.key = app.key
    on conflict (id) do update set file_name = excluded.file_name, size_bytes = excluded.size_bytes;

    select coalesce(jsonb_object_agg(q.id::text, a.value), '{}'::jsonb) into answers_
    from (select label, value from lov_answer where key = app.key
          union all
          select '@PROPOSAL_FILE@', app.proposal_file_id::text where app.proposal_file_id is not null) a
    join program_question q on q.program_id = program_id_ and q.label = a.label
        and q.kind = case when a.label = '@PROPOSAL_FILE@' then 'file' else 'long_text' end;

    update proposal set solution_id = solution_, status = app.status, contact = app.contact,
           team_background = app.team_background, deck_file_id = app.deck_file_id, built_with = app.built_with,
           traction = app.traction, answers = answers_,
           submissions = case when app.status = 'submitted' then 1 else 0 end, submitted_at = app.submitted_at,
           updated_at = app.updated_at
    where id = app.proposal_id;

    delete from proposal_version where proposal_id = app.proposal_id;
    if app.status = 'submitted' and solution_ is not null then
        perform pg_temp.lov_version(key_, program_id_, organization_, solution_, answers_);
    end if;
end $f$;
do $$
declare
    app record;
    program_id_ uuid;
    account uuid;
    organization_ uuid;
    solution_ uuid;
    address text;
    suffix integer;
    answers_ jsonb;
    accounts integer := 0;
    organizations integer := 0;
    solutions integer := 0;
    loaded integer := 0;
    versions integer := 0;
    kept integer := 0;
    updated integer := 0;
    changed_here integer := 0;
    existing proposal%rowtype;
begin
    select id into strict program_id_ from program where slug = '@PROGRAM@';
    for app in select * from lov_app order by email loop
        select id into account from identity_account where lower(identity_account.email) = app.email;
        if account is null then
            account := app.account_id;
            insert into identity_account (id, email, display_name) values (account, app.email, app.display_name);
            accounts := accounts + 1;
        end if;
        -- An application loaded before and changed on the old page since is brought up to date, as long as nobody
        -- saved it, its organization or its solution on BeyondPilot (their versions are still 0). Anything else that
        -- exists is kept untouched: a person's own work here is never overwritten.
        select * into existing from proposal where program_id = program_id_ and account_id = account;
        if found then
            if existing.id = app.proposal_id and existing.updated_at < app.updated_at then
                if existing.version = 0
                        and not exists (select 1 from solution where id = existing.solution_id and version <> 0)
                        and not exists (select 1 from organization where id = existing.organization_id
                                            and (id <> app.organization_id or version <> 0)) then
                    perform pg_temp.lov_update(app.key, program_id_, account, existing.organization_id);
                    updated := updated + 1;
                else
                    changed_here := changed_here + 1;
                end if;
            else
                kept := kept + 1;
            end if;
            continue;
        end if;
        -- As IdentityAccounts.reachAtIfUnknown: what the applicant stated, where the account says nothing.
        update identity_account set country = coalesce(country, app.country), phone = coalesce(phone, app.phone)
        where id = account and (country is null or phone is null);

        -- A person is in one organization: the one they are in already, or the one they named on the form.
        select organization_id into organization_ from organization_member where account_id = account;
        if organization_ is null and app.organization_name is not null then
            organization_ := app.organization_id;
            address := app.organization_slug;
            suffix := 2;
            while exists (select 1 from organization where slug = address) loop
                address := app.organization_slug || '-' || suffix;
                suffix := suffix + 1;
            end loop;
            insert into organization (id, slug, name, type, website, country, team_size, status,
                                      created_by_account_id, created_at, updated_at)
            values (organization_, address, app.organization_name, app.organization_type, app.website,
                    app.business_country, app.team_size, 'in_review', account, app.created_at, app.created_at);
            insert into organization_member (organization_id, account_id, role, created_at)
            values (organization_, account, 'owner', app.created_at);
            organizations := organizations + 1;
        end if;

        solution_ := null;
        if organization_ is not null and app.solution_name is not null then
            solution_ := app.solution_id;
            address := app.solution_slug;
            suffix := 2;
            while exists (select 1 from solution where slug = address) loop
                address := app.solution_slug || '-' || suffix;
                suffix := suffix + 1;
            end loop;
            insert into solution (id, organization_id, slug, name, summary, problems_solved, maturity, demo_url,
                                  built_with, status, listed, created_by_account_id, created_at, updated_at)
            values (solution_, organization_, address, app.solution_name, app.summary, app.problems_solved,
                    app.maturity, app.demo_url, app.solution_built, 'draft', true, account, app.created_at,
                    app.updated_at);
            solutions := solutions + 1;
        end if;

        insert into storage_file (id, provider, object_key, purpose, public_read, file_name, media_type, size_bytes,
                                  status, uploaded_by_account_id, upload_expires_at, created_at, stored_at)
        select f.id, 'local', f.object_key, 'application_file', false, f.file_name, 'application/pdf', f.size_bytes,
               'stored', account, now(), now(), now()
        from lov_file f where f.key = app.key;

        -- The answers the program asks for, by the label of the question.
        select coalesce(jsonb_object_agg(q.id::text, a.value), '{}'::jsonb) into answers_
        from (select label, value from lov_answer where key = app.key
              union all
              select '@PROPOSAL_FILE@', app.proposal_file_id::text where app.proposal_file_id is not null) a
        join program_question q on q.program_id = program_id_ and q.label = a.label
            and q.kind = case when a.label = '@PROPOSAL_FILE@' then 'file' else 'long_text' end;

        insert into proposal (id, program_id, account_id, organization_id, solution_id, status, contact,
                              team_background, deck_file_id, built_with, traction, answers, submissions,
                              submitted_at, created_at, updated_at)
        values (app.proposal_id, program_id_, account, organization_, solution_, app.status, app.contact,
                app.team_background, app.deck_file_id, app.built_with, app.traction, answers_,
                case when app.status = 'submitted' then 1 else 0 end, app.submitted_at, app.created_at,
                app.updated_at);
        loaded := loaded + 1;

        if app.status = 'submitted' then
            perform pg_temp.lov_version(app.key, program_id_, organization_, solution_, answers_);
            versions := versions + 1;
        end if;
    end loop;
    raise notice 'lovable import: % applicants, % applications loaded (% submitted), % brought up to date, % changed on both sides and left as they are here, % kept as they are, % accounts, % organizations, % solutions created',
        (select count(*) from lov_app), loaded, versions, updated, changed_here, kept, accounts, organizations, solutions;
end $$;
commit;
"""


if __name__ == "__main__":
    print(json.dumps(build(Path(sys.argv[1]), Path(sys.argv[2])), indent=2, ensure_ascii=False))
