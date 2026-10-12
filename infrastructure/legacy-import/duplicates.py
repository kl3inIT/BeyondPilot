"""Merges the organizations the old platform holds twice, and takes their duplicate solutions off the list.

    python duplicates.py <full-export.xlsx> <output directory>

Writes `<output>/duplicates.sql`. A company that registered several times on the old platform became several
organizations here, each with its own solution. Two organizations are surely one company when they have one name,
read without its legal form, and one website. Of each such group one is kept: the one whose solution has a deck, then
the one active on the old platform, then the fuller record, then the one updated last there. The others are merged
into it as `OrganizationAdministration.merge` does it: their open invitations, requests, solutions, offers, use cases,
proposals, introductions and enquiries move to the kept one, and each stays as a record of where it went.

The solutions that are then several under the kept organization are the same product described several times: the
best one by the same order stays listed and the others are taken off the list, not deleted.

A group is left for a person when an organization in it has members, or when the one to keep is not approved: merging
it moves people or needs a review, which a rule does not decide. The file ends by listing what it merged and what it
left. It takes the operator account as `-v operator=<uuid>`; rebuild the search index after it.
"""

import json
import sys
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))  # run with -I, so the folder is added explicitly

import build
import enterprises
import mapping
import records
import report


def v1_facts(startup_rows, enterprise_rows) -> list[tuple[str, bool, str]]:
    """What the old platform knew of each company the load took: whether it was active, and when it last changed."""
    found = []
    for row in startup_rows:
        code = mapping.clean(row.get("startup_code"))
        if code is not None:
            found.append((str(records.ident("startup-organization", code)), row.get("is_active") is True,
                          str(row.get("updated_at") or "")))
    for row in enterprise_rows:
        key = mapping.clean(row.get("id"))
        if key is not None:
            found.append((str(records.ident("enterprise-organization", key)), row.get("isActive") is True,
                          str(row.get("updatedAt") or "")))
    return found


MERGE = enterprises.SAME_COMPANY + r"""
-- How much of a solution is written; a deck counts for three.
create function pg_temp.filled(s solution) returns integer language sql stable as $$
    select (s.summary is not null)::int + (s.problems_solved is not null)::int + (s.value_proposition is not null)::int
         + (s.maturity is not null)::int + (s.demo_url is not null)::int + (s.traction is not null)::int
         + (s.best_customer_profile is not null)::int + (s.core_technology is not null)::int
         + (s.notable_paying_customers is not null)::int + (s.logo_file_id is not null)::int
         + (s.cover_file_id is not null)::int + (cardinality(s.focus_areas) > 0)::int
         + (cardinality(s.industries) > 0)::int + (s.deck_file_id is not null)::int * 3
$$;

create temp table candidate on commit drop as
select o.id, o.name, o.status, pg_temp.name_key(o.name) as key, pg_temp.host(o.website) as host,
       (select count(*) from organization_member m where m.organization_id = o.id) as members,
       exists (select 1 from solution s where s.organization_id = o.id and s.deck_file_id is not null) as has_deck,
       coalesce((select max(pg_temp.filled(s)) from solution s where s.organization_id = o.id), 0)
           + (o.description is not null)::int + (o.logo_file_id is not null)::int + (o.country is not null)::int as filled,
       coalesce(v.active, true) as active, coalesce(v.updated, '') as updated
from organization o left join legacy_company v on v.id = o.id
where o.status <> 'merged';

create temp table ranked on commit drop as
select c.*,
       row_number() over (partition by c.key, c.host
                          order by c.has_deck desc, c.active desc, c.filled desc, c.updated desc, c.id) as place,
       bool_or(c.members > 0) over (partition by c.key, c.host) as has_people
from candidate c
where c.key <> '' and c.host <> ''
  and (c.key, c.host) in (select key, host from candidate where key <> '' and host <> ''
                          group by key, host having count(*) > 1);

-- Each duplicate and the organization it goes into; a group a rule does not decide says why instead.
create temp table merge_plan on commit drop as
select d.id as duplicate, k.id as kept, d.name as duplicate_name, k.name as kept_name,
       case when d.has_people then 'an organization of the group has members'
            when k.status <> 'approved' then 'the one to keep is not approved' end as left_because
from ranked d join ranked k on k.key = d.key and k.host = d.host and k.place = 1
where d.place > 1;

do $$
declare
    pair record;
    merged integer := 0;
    unlisted integer := 0;
begin
    for pair in select * from merge_plan where left_because is null loop
        -- As MembershipRepository.moveOpenInvitations and moveOpenRequests.
        update organization_invitation set status = 'expired', decided_at = now()
        where organization_id in (pair.duplicate, pair.kept) and status = 'pending' and expires_at <= now();
        update organization_invitation moved set status = 'revoked', decided_at = now()
        where moved.organization_id = pair.duplicate and moved.status = 'pending'
          and exists (select 1 from organization_invitation kept
                      where kept.organization_id = pair.kept and kept.status = 'pending'
                        and lower(kept.email) = lower(moved.email));
        update organization_invitation set organization_id = pair.kept, role = 'member'
        where organization_id = pair.duplicate and status = 'pending';
        update organization_join_request
        set organization_id = pair.kept,
            claim = not exists (select 1 from organization_member m
                                where m.organization_id = pair.kept and m.role = 'owner')
        where organization_id = pair.duplicate and status = 'pending';
        -- As the modules that keep records of organizations move theirs when OrganizationMerged is published.
        update solution set organization_id = pair.kept, version = version + 1 where organization_id = pair.duplicate;
        update offer set organization_id = pair.kept, version = version + 1 where organization_id = pair.duplicate;
        update use_case set organization_id = pair.kept, version = version + 1 where organization_id = pair.duplicate;
        update proposal set organization_id = pair.kept, version = version + 1 where organization_id = pair.duplicate;
        update use_case_proposal p set organization_id = pair.kept, version = version + 1
        where p.organization_id = pair.duplicate
          and not exists (select 1 from use_case_proposal k
                          where k.use_case_id = p.use_case_id and k.organization_id = pair.kept);
        delete from use_case_proposal where organization_id = pair.duplicate and status = 'draft';
        update introduction_request set provider_organization_id = pair.kept
        where provider_organization_id = pair.duplicate;
        update introduction_request set sender_organization_id = pair.kept where sender_organization_id = pair.duplicate;
        update talent_enquiry set sender_organization_id = pair.kept where sender_organization_id = pair.duplicate;
        -- As Organization.mergeInto: the duplicate stays as a record of where it went.
        update organization
        set status = 'merged', merged_into_id = pair.kept, merged_at = now(),
            merged_by_account_id = current_setting('legacy.operator')::uuid, email_domain = null, auto_join = false,
            version = version + 1, updated_at = now()
        where id = pair.duplicate;
        merged := merged + 1;
    end loop;

    -- Under each kept organization the solutions with one name are one product: the best stays listed.
    with product as (
        select s.id,
               row_number() over (partition by s.organization_id, pg_temp.name_key(s.name)
                                  order by (s.deck_file_id is not null) desc, coalesce(v.active, true) desc,
                                           pg_temp.filled(s) desc, coalesce(v.updated, '') desc, s.id) as place
        from solution s
        left join legacy_company v on v.solution_id = s.id
        where s.organization_id in (select kept from merge_plan where left_because is null)),
    taken as (
        update solution s set listed = false, version = s.version + 1, updated_at = now()
        from product p where p.id = s.id and p.place > 1 and s.listed
        returning s.id)
    select count(*) into unlisted from taken;

    raise notice 'legacy import: % organizations merged into % kept ones, % solutions taken off the list, % organizations in % groups left for a person',
        merged, (select count(distinct kept) from merge_plan where left_because is null), unlisted,
        (select count(*) from merge_plan where left_because is not null),
        (select count(distinct kept) from merge_plan where left_because is not null);
end $$;

-- What a person decides, as counts; and how many matching results point at a solution no longer listed.
select left_because, count(*) from merge_plan where left_because is not null group by left_because order by 1;
select 'matching results on a solution taken off the list', count(*), count(distinct c.use_case_id)
from matching_candidate c join solution s on s.id = c.solution_id
where not s.listed and s.organization_id in (select kept from merge_plan where left_because is null);
commit;
"""


def sql(facts: list[tuple[str, bool, str]]) -> str:
    lines = [
        "-- Merges the organizations the old platform holds twice, built by infrastructure/legacy-import/duplicates.py.",
        build.HEAD,
        "create temp table legacy_company (id uuid primary key, solution_id uuid, active boolean not null, "
        "updated text not null) on commit drop;",
    ]
    for organization_id, active, updated in facts:
        lines.append(f"insert into legacy_company (id, active, updated) values ({build.lit(organization_id)}, "
                     f"{build.lit(active)}, {build.lit(updated)});")
    # A solution moves with its organization, so what v1 knew of it is tied to the solution before anything moves.
    lines.append("update legacy_company v set solution_id = s.id from solution s where s.organization_id = v.id "
                 "and (select count(*) from solution x where x.organization_id = v.id) = 1;")
    return "\n".join(lines) + MERGE


def main(workbook_path: Path, out: Path) -> dict:
    workbook = openpyxl.load_workbook(workbook_path, read_only=True, data_only=True)
    facts = v1_facts(report.sheet(workbook, "startups"), report.sheet(workbook, "enterprises"))
    out.mkdir(parents=True, exist_ok=True)
    (out / "duplicates.sql").write_text(sql(facts), encoding="utf-8", newline="\n")
    return {"companies_of_v1": len(facts)}


if __name__ == "__main__":
    print(json.dumps(main(Path(sys.argv[1]), Path(sys.argv[2])), indent=2, ensure_ascii=False))
