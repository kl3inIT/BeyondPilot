"""The enterprises of the old platform's full export, as the organization each one is here.

    python enterprises.py <full-export.xlsx> <output directory>

Writes two files, each run on its own:

- `<output>/enterprise-profiles.sql` completes the organizations the use cases' load made from a name and an industry
  alone: website, country, team size, description and founding year. It fills what is empty and overwrites nothing,
  so what an operator or a member wrote since stays.
- `<output>/enterprise-organizations.sql` creates the organization of each enterprise that has people on the old
  platform and no use case, so that its people can be invited to it. One whose name or website an organization
  already has is not created; the file ends by listing those. It takes the operator account as `-v operator=<uuid>`.
"""

import collections
import json
import re
import sys
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))  # run with -I, so the folder is added explicitly

import build
import mapping
import records
import report

# A website v1 holds without its scheme ("www.acme.com/vn"): a host with a dot, then an optional path.
BARE_WEBSITE = re.compile(r"(?i)^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(/\S*)?$")


def website(value) -> str | None:
    """The address as the organization's profile accepts it; one written without a scheme gets https."""
    text = mapping.clean(value)
    if text is None or report.TEST_WEBSITE.search(text):
        return None
    if re.match(r"(?i)^https?://\S+$", text):
        return text
    return "https://" + text if BARE_WEBSITE.match(text) else None


def profile(row) -> records.Organization | None:
    """An enterprise as its organization, with the identifier the use cases' load gave it. None for a test record."""
    key = mapping.clean(row.get("id"))
    name = mapping.clean(row.get("companyName"))
    if key is None or name is None or report.TEST_NAME.match(name.strip()):
        return None
    return records.Organization(
        id=records.ident("enterprise-organization", key), name=name, website=website(row.get("website")),
        country=mapping.country(row.get("headquarters"))[0],
        team_size=mapping.team_size(row.get("employeeCount"))[0],
        company_size_label=mapping.clean(row.get("employeeCount")),
        industries=mapping.industries(row.get("industry")).codes,
        description=records.shorten(mapping.clean(row.get("description")), records.ORGANIZATION_DESCRIPTION),
        founded_year=records.year(row.get("foundedYear")))


def read(workbook) -> list[records.Organization]:
    return [found for row in report.sheet(workbook, "enterprises") if (found := profile(row)) is not None]


def missing(enterprise_rows, representative_rows, use_case_rows) -> list[records.Organization]:
    """The enterprises that have people and no use case, the one with the most people first: of two records of one
    company, the load keeps the first it meets. An enterprise with a use case has its organization already."""
    owners = {mapping.clean(row.get("enterpriseId")) for row in use_case_rows}
    people = collections.Counter(key for row in representative_rows
                                 if (key := mapping.clean(row.get("enterpriseId"))) is not None)
    found = []
    for position, row in enumerate(enterprise_rows):
        key = mapping.clean(row.get("id"))
        if key in people and key not in owners and (organization := profile(row)) is not None:
            found.append((-people[key], str(row.get("createdAt") or ""), position, organization))
    return [organization for *_, organization in sorted(found, key=lambda entry: entry[:3])]


FILL = r"""
do $$
declare
    filled integer;
begin
    with changed as (
        update organization o
        set website            = coalesce(nullif(o.website, ''), e.website),
            country            = coalesce(o.country, e.country),
            team_size          = coalesce(o.team_size, e.team_size),
            company_size_label = coalesce(nullif(o.company_size_label, ''), e.company_size_label),
            description        = coalesce(nullif(o.description, ''), e.description),
            founded_year       = coalesce(o.founded_year, e.founded_year),
            industries         = case when cardinality(o.industries) = 0 then e.industries else o.industries end,
            version            = o.version + 1,
            updated_at         = now()
        from legacy_enterprise e
        where o.id = e.id
          and ((nullif(o.website, '') is null and e.website is not null)
            or (o.country is null and e.country is not null)
            or (o.team_size is null and e.team_size is not null)
            or (nullif(o.company_size_label, '') is null and e.company_size_label is not null)
            or (nullif(o.description, '') is null and e.description is not null)
            or (o.founded_year is null and e.founded_year is not null)
            or (cardinality(o.industries) = 0 and cardinality(e.industries) > 0))
        returning o.id)
    select count(*) into filled from changed;
    raise notice 'legacy import: % of % enterprises have an organization here, % completed',
        (select count(*) from organization o join legacy_enterprise e on e.id = o.id),
        (select count(*) from legacy_enterprise), filled;
end $$;
commit;
"""


def fill_sql(organizations: list[records.Organization]) -> str:
    lines = [
        "-- Completes the organizations of the old platform's enterprises, built by",
        "-- infrastructure/legacy-import/enterprises.py. Run after a dump: psql -v ON_ERROR_STOP=1 -f -",
        r"\set ON_ERROR_STOP on",
        "begin;",
        "create temp table legacy_enterprise (id uuid primary key, website text, country text, team_size text, "
        "company_size_label text, description text, founded_year integer, industries text[] not null) on commit drop;",
    ]
    for organization in organizations:
        lines.append(
            "insert into legacy_enterprise values ("
            f"{build.lit(str(organization.id))}, {build.lit(organization.website)}, {build.lit(organization.country)}, "
            f"{build.lit(organization.team_size)}, {build.lit(organization.company_size_label)}, "
            f"{build.lit(organization.description)}, {build.lit(organization.founded_year)}, "
            f"{build.array(organization.industries)});")
    return "\n".join(lines) + FILL


CREATE = r"""
-- A name as mapping.normalised_name reads it: lowercase, without the legal form, letters and digits only.
create function pg_temp.name_key(name text) returns text language sql immutable as $$
    select regexp_replace(regexp_replace(lower(coalesce(name, '')),
        '\m(pte|ltd|limited|inc|llc|jsc|co|corp|corporation|company|sdn|bhd|pt|tbk|joint stock)\M\.?', '', 'g'),
        '[^a-z0-9]+', '', 'g')
$$;

-- The host of a website, without its scheme, `www.`, port and path.
create function pg_temp.host(website text) returns text language sql immutable as $$
    select regexp_replace(regexp_replace(lower(coalesce(website, '')), '^[a-z]+://(www\.)?', ''), '[/:?#].*$', '')
$$;

-- Why an enterprise gets no organization, or null when it gets one.
create function pg_temp.taken(candidate uuid, its_name text, its_domain text) returns text language plpgsql as $$
begin
    if exists (select 1 from organization where id = candidate) then
        return 'loaded already';
    end if;
    if pg_temp.name_key(its_name) <> ''
            and exists (select 1 from organization o where pg_temp.name_key(o.name) = pg_temp.name_key(its_name)) then
        return 'an organization has this name';
    end if;
    if its_domain is not null and exists (select 1 from organization o
                                      where pg_temp.host(o.website) = its_domain
                                         or pg_temp.host(o.website) like '%.' || its_domain) then
        return 'an organization has this website';
    end if;
    return null;
end $$;

do $$
declare
    enterprise record;
    reason text;
    created integer := 0;
begin
    for enterprise in select * from legacy_enterprise order by position loop
        reason := pg_temp.taken(enterprise.id, enterprise.name, enterprise.domain);
        if reason is null then
            insert into organization (id, slug, name, type, website, country, team_size, company_size_label,
                                      description, auto_join, status, created_by_account_id, industries, founded_year)
            values (enterprise.id, pg_temp.free_slug('organization', enterprise.slug), enterprise.name, 'company',
                    enterprise.website, enterprise.country, enterprise.team_size, enterprise.company_size_label,
                    enterprise.description, false, 'in_review', current_setting('legacy.operator')::uuid,
                    enterprise.industries, enterprise.founded_year);
            created := created + 1;
        else
            update legacy_enterprise set outcome = reason where id = enterprise.id;
        end if;
    end loop;
    raise notice 'legacy import: % enterprises with people and no use case, % organizations created, % not created',
        (select count(*) from legacy_enterprise), created, (select count(*) from legacy_enterprise) - created;
end $$;

-- What was not created and why, for the operator who decides about them. It names companies: keep it with the export.
select outcome, name from legacy_enterprise where outcome is not null order by outcome, name;
commit;
"""


def create_sql(organizations: list[records.Organization]) -> str:
    lines = [
        "-- Creates the organizations of the old platform's enterprises that have people and none here, built by",
        "-- infrastructure/legacy-import/enterprises.py.",
        build.HEAD,
        "create temp table legacy_enterprise (position integer primary key, id uuid not null, slug text not null, "
        "name text not null, domain text, website text, country text, team_size text, company_size_label text, "
        "description text, founded_year integer, industries text[] not null, outcome text) on commit drop;",
    ]
    for position, organization in enumerate(organizations):
        lines.append(
            "insert into legacy_enterprise values ("
            f"{position}, {build.lit(str(organization.id))}, {build.lit(build.slug(organization.name, 'organization'))}, "
            f"{build.lit(organization.name)}, {build.lit(mapping.registrable_domain(organization.website))}, "
            f"{build.lit(organization.website)}, {build.lit(organization.country)}, "
            f"{build.lit(organization.team_size)}, {build.lit(organization.company_size_label)}, "
            f"{build.lit(organization.description)}, {build.lit(organization.founded_year)}, "
            f"{build.array(organization.industries)}, null);")
    return "\n".join(lines) + CREATE


def main(workbook_path: Path, out: Path) -> dict:
    workbook = openpyxl.load_workbook(workbook_path, read_only=True, data_only=True)
    rows = report.sheet(workbook, "enterprises")
    organizations = read(workbook)
    to_create = missing(rows, report.sheet(workbook, "representatives"), report.sheet(workbook, "use_cases"))
    out.mkdir(parents=True, exist_ok=True)
    (out / "enterprise-profiles.sql").write_text(fill_sql(organizations), encoding="utf-8", newline="\n")
    (out / "enterprise-organizations.sql").write_text(create_sql(to_create), encoding="utf-8", newline="\n")
    return {
        "enterprises": len(rows), "left_out_as_test": len(rows) - len(organizations),
        "with_people_and_no_use_case": len(to_create),
        "with": {part: sum(1 for o in organizations if getattr(o, part))
                 for part in ("website", "country", "team_size", "company_size_label", "description", "founded_year",
                              "industries")},
        "website_not_an_address": sum(1 for row in rows if mapping.clean(row.get("website"))
                                      and website(row.get("website")) is None),
        "country_without_a_code": sorted({label for row in rows
                                          if (label := mapping.country(row.get("headquarters"))[1])}),
    }


if __name__ == "__main__":
    print(json.dumps(main(Path(sys.argv[1]), Path(sys.argv[2])), indent=2, ensure_ascii=False))
