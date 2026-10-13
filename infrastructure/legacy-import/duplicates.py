"""Merges the organizations that are one company, and refuses their duplicate solutions.

    python duplicates.py <full-export.xlsx> <output directory> [<same-company.json>]

Writes `<output>/duplicates.sql`. A company that registered several times on the old platform, or once there and once
here, became several organizations, each with its own solution. Organizations are one company when they have one name,
read without its legal form, and one website domain among them, which at least one of them names. Those with one name
and different domains are merged only when a person found them to be one company: `same-company.json` lists such
names as `{"<name key>": {"website": "<the one to keep, or null>", "several": <true when the records are different
products of the company>}}`.

Of each group one is kept: an approved one before another, then the one whose solution has a deck, then the one
active on the old platform, then the fuller record, then the one updated last there. The others are merged into it as
`OrganizationAdministration.merge` does it: their members, open invitations, requests, solutions, offers, use cases,
proposals and enquiries move to the kept one, and each stays as a record of where it went. The kept
one takes a website when it has none.

The solutions that are then several under the kept organization are the same product described several times: the
best one by the same order stays, and the others are refused as duplicates, as an operator refuses a solution. Where a
person found the records to be different products of one company, each registered with its own website, every
solution stays. Taking
one off the list would not do: search and matching read an approved solution listed or not. A refused solution is in
neither, keeps everything it holds, and can be reviewed again.

A group is left for a person when a member of one of its organizations has signed in: the application's merge tells
the people it moves, and this file sends nothing. The file ends by counting what it merged and what it left. It takes
the operator account as `-v operator=<uuid>`; rebuild the search index after it.
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


def v1_facts(startup_rows, enterprise_rows) -> list[tuple[str, str | None, bool, str]]:
    """What the old platform knew of each company the load took: the organization and the solution it became,
    whether it was active, and when it last changed. An enterprise has no solution."""
    found = []
    for row in startup_rows:
        code = mapping.clean(row.get("startup_code"))
        if code is not None:
            found.append((str(records.ident("startup-organization", code)),
                          str(records.ident("startup-solution", code)), row.get("is_active") is True,
                          str(row.get("updated_at") or "")))
    for row in enterprise_rows:
        key = mapping.clean(row.get("id"))
        if key is not None:
            found.append((str(records.ident("enterprise-organization", key)), None, row.get("isActive") is True,
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

-- The domain a company owns, as mapping.registrable_domain reads it, without the hosts anyone has a page on.
create function pg_temp.domain(host text) returns text language sql immutable as $$
    select case
        when host = '' or host !~ '\.' then ''
        when host ~ '(^|\.)(linkedin\.com|x\.com|twitter\.com|facebook\.com|instagram\.com|github\.com|github\.io|medium\.com|notion\.site|wixsite\.com|vercel\.app|netlify\.app|google\.com|youtube\.com|test\.com|bit\.ly|linktr\.ee|tiktok\.com|t\.me|wordpress\.com|webflow\.io|framer\.website|framer\.ai|carrd\.co|substack\.com|apple\.com)$'
            then ''
        when host ~ '\.(com|co|net|org|gov|edu|ac)\.[a-z]{2}$' then substring(host from '[^.]+\.[^.]+\.[^.]+$')
        else substring(host from '[^.]+\.[^.]+$') end
$$;

create temp table candidate on commit drop as
select o.id, o.name, o.status, o.website, pg_temp.name_key(o.name) as key,
       pg_temp.domain(pg_temp.host(o.website)) as domain,
       (select count(*) from organization_member m join identity_account a on a.id = m.account_id
        where m.organization_id = o.id and a.last_login_at is not null) as signed_in,
       exists (select 1 from solution s where s.organization_id = o.id and s.deck_file_id is not null) as has_deck,
       coalesce((select max(pg_temp.filled(s)) from solution s where s.organization_id = o.id), 0)
           + (o.description is not null)::int + (o.logo_file_id is not null)::int + (o.country is not null)::int as filled,
       coalesce(v.active, true) as active, coalesce(v.updated, '') as updated
from organization o left join legacy_company v on v.id = o.id
where o.status not in ('merged', 'rejected');

-- The names that are one company: one domain among several organizations, which at least one of them names, or a
-- name a person found to be one company.
create temp table one_company on commit drop as
select c.key from candidate c where c.key <> '' group by c.key
having count(*) > 1
   and ((count(distinct c.domain) filter (where c.domain <> '') = 1)
        or c.key in (select key from legacy_same));

create temp table ranked on commit drop as
select c.*,
       row_number() over (partition by c.key
                          order by (c.status = 'approved') desc, c.has_deck desc, c.active desc, c.filled desc,
                                   c.updated desc, c.id) as place,
       bool_or(c.signed_in > 0) over (partition by c.key) as has_people
from candidate c where c.key in (select key from one_company);

-- Each duplicate and the organization it goes into; a group a rule does not decide says why instead.
create temp table merge_plan on commit drop as
select d.id as duplicate, k.id as kept, d.key,
       coalesce((select website from legacy_same l where l.key = d.key), nullif(d.website, '')) as website,
       case when d.has_people then 'a member of the group has signed in' end as left_because
from ranked d join ranked k on k.key = d.key and k.place = 1
where d.place > 1;

do $$
declare
    pair record;
    merged integer := 0;
    refused_count integer := 0;
    results_gone integer := 0;
begin
    for pair in select * from merge_plan where left_because is null loop
        -- As MembershipRepository.moveMembers, moveOpenInvitations and moveOpenRequests.
        update organization_member set organization_id = pair.kept, role = 'member', merged_from_id = pair.duplicate
        where organization_id = pair.duplicate;
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
        update talent_enquiry set sender_organization_id = pair.kept where sender_organization_id = pair.duplicate;
        -- As Organization.mergeInto: the duplicate stays as a record of where it went.
        update organization
        set status = 'merged', merged_into_id = pair.kept, merged_at = now(),
            merged_by_account_id = current_setting('legacy.operator')::uuid, email_domain = null, auto_join = false,
            version = version + 1, updated_at = now()
        where id = pair.duplicate;
        -- The kept one takes a website when it has none, and the one a person chose for the name when they chose one.
        update organization
        set website = pair.website, version = version + 1, updated_at = now()
        where id = pair.kept and pair.website is not null and website is distinct from pair.website
          and (nullif(website, '') is null
               or exists (select 1 from legacy_same l where l.key = pair.key and l.website is not null));
        merged := merged + 1;
    end loop;

    -- Under an organization others were merged into now, the solutions with one name are one product described
    -- several times. The best stays; the others are refused as duplicates, as an operator refuses one, which takes
    -- them out of the directory, of search and of matching, and can be reviewed again. A company a person found to
    -- have registered different products keeps them all.
    with product as (
        select s.id,
               row_number() over (partition by s.organization_id, pg_temp.name_key(s.name)
                                  order by (s.status = 'approved') desc, (s.status <> 'draft') desc,
                                           (s.deck_file_id is not null) desc, coalesce(v.active, true) desc, pg_temp.filled(s) desc,
                                           coalesce(v.updated, '') desc, s.id) as place,
               first_value(s.name) over (partition by s.organization_id, pg_temp.name_key(s.name)
                                         order by (s.status = 'approved') desc, (s.status <> 'draft') desc,
                                                  (s.deck_file_id is not null) desc, coalesce(v.active, true) desc, pg_temp.filled(s) desc,
                                                  coalesce(v.updated, '') desc, s.id) as best
        from solution s
        left join legacy_company v on v.solution_id = s.id
        -- A draft counts when it is a record of the old platform; one a member began here is theirs to finish.
        where (s.status in ('approved', 'in_review') or (s.status = 'draft' and v.solution_id is not null))
          and s.organization_id in (select kept from merge_plan
                                    where left_because is null
                                      and key not in (select key from legacy_same where several))),
    refused as (
        update solution s
        set status = 'rejected', decision_reason = 'duplicate', decided_at = now(),
            decision_message = 'This company registered more than once on the old platform. Its organizations were '
                || 'merged into one, and "' || p.best || '" is the record that was kept.',
            version = s.version + 1, updated_at = now()
        from product p where p.id = s.id and p.place > 1
        returning s.id)
    insert into legacy_ids (id) select id from refused;
    select count(*) into refused_count from legacy_ids;

    -- A matching result on a solution that is refused now is no result; one a person decided or answered on stays.
    delete from matching_candidate c
    where c.solution_id in (select id from legacy_ids)
      and not exists (select 1 from matching_decision d where d.candidate_id = c.id)
      and not exists (select 1 from matching_feedback f where f.candidate_id = c.id);
    get diagnostics results_gone = row_count;

    raise notice 'legacy import: % organizations merged into % kept ones, % solutions refused as duplicates, % matching results on them removed, % organizations in % groups left for a person',
        merged, (select count(distinct kept) from merge_plan where left_because is null), refused_count, results_gone,
        (select count(*) from merge_plan where left_because is not null),
        (select count(distinct kept) from merge_plan where left_because is not null);
end $$;

-- What a person decides, as counts.
select left_because, count(*) from merge_plan where left_because is not null group by left_because order by 1;
commit;
"""


def sql(facts: list[tuple[str, str | None, bool, str]], same: dict[str, dict] | None = None) -> str:
    lines = [
        "-- Merges the organizations the old platform holds twice, built by infrastructure/legacy-import/duplicates.py.",
        build.HEAD,
        "create temp table legacy_company (id uuid primary key, solution_id uuid, active boolean not null, "
        "updated text not null) on commit drop;",
    ]
    lines.append("create temp table legacy_same (key text primary key, website text, several boolean not null) "
                 "on commit drop;")
    for key, found in sorted((same or {}).items()):
        lines.append(f"insert into legacy_same values ({build.lit(key)}, {build.lit(found.get('website'))}, "
                     f"{build.lit(found.get('several') is True)});")
    for organization_id, solution_id, active, updated in facts:
        lines.append(f"insert into legacy_company (id, solution_id, active, updated) values ("
                     f"{build.lit(organization_id)}, {build.lit(solution_id)}, {build.lit(active)}, "
                     f"{build.lit(updated)});")
    return "\n".join(lines) + MERGE


def main(workbook_path: Path, out: Path, same_path: Path | None = None) -> dict:
    workbook = openpyxl.load_workbook(workbook_path, read_only=True, data_only=True)
    facts = v1_facts(report.sheet(workbook, "startups"), report.sheet(workbook, "enterprises"))
    same = json.loads(same_path.read_text(encoding="utf-8")) if same_path else {}
    out.mkdir(parents=True, exist_ok=True)
    (out / "duplicates.sql").write_text(sql(facts, same), encoding="utf-8", newline="\n")
    return {"companies_of_v1": len(facts), "names_a_person_found_to_be_one_company": len(same)}


if __name__ == "__main__":
    print(json.dumps(main(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]) if len(sys.argv) > 3 else None),
                     indent=2, ensure_ascii=False))
