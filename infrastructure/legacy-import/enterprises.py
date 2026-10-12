"""The enterprises of the old platform's full export, as the profile of the organization each one is here.

    python enterprises.py <full-export.xlsx> <output directory>

Writes `<output>/enterprise-profiles.sql`, which completes the organizations the use cases' load made from a name and
an industry alone: website, country, team size, description and founding year. It fills what is empty and overwrites
nothing, so what an operator or a member wrote since stays. An enterprise with no organization here is left alone.
"""

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


def main(workbook_path: Path, out: Path) -> dict:
    workbook = openpyxl.load_workbook(workbook_path, read_only=True, data_only=True)
    rows = report.sheet(workbook, "enterprises")
    organizations = read(workbook)
    out.mkdir(parents=True, exist_ok=True)
    (out / "enterprise-profiles.sql").write_text(fill_sql(organizations), encoding="utf-8", newline="\n")
    return {
        "enterprises": len(rows), "left_out_as_test": len(rows) - len(organizations),
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
