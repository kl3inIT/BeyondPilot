"""The people of the old platform's full export, as invitations to the organization each one's company is here.

    python people.py <full-export.xlsx> <output directory>

Writes `<output>/startup-invitations.sql` and `<output>/enterprise-invitations.sql`: an operator's invitation for each
person of a startup or an enterprise, to the organization the load made for it. Nobody gets an account and no email is
sent: whoever signs in with the address sees the invitation and accepts it. The invitation does not lapse.

Only a person who is surely the company's is invited: one whose address is on the company's own website domain. An
address on a public mail service or on another domain gets none, and neither does a company with no website of its
own; such a person asks for the organization once signed in, and an operator decides. An address that belongs to an
organization already, or is an operator's, gets none either. Each file takes the operator account as
`-v operator=<uuid>` and ends by counting what it did not write and why.

An enterprise whose organization was not created because the company is here already (`enterprises.py`) has its
people invited to that organization, as members: the one that has its website, or the one that has its name when the
person's address is on that organization's website.
"""

import collections
import json
import re
import sys
import uuid
from dataclasses import dataclass
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))  # run with -I, so the folder is added explicitly

import build
import enterprises
import mapping
import records
import report

ADDRESS = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Mail services anyone has an address on: such a domain never says whose company a person is.
PUBLIC_MAIL = {"gmail.com", "googlemail.com", "yahoo.com", "yahoo.com.vn", "hotmail.com", "outlook.com", "live.com",
               "icloud.com", "me.com", "proton.me", "protonmail.com", "qq.com", "163.com", "naver.com"}

# Who founded or leads a company, in the position v1 offers and the job title a person types.
LEADS = re.compile(r"(?i)\b(co-?founder|founder|owner|ceo|chief executive)\b")


@dataclass
class Company:
    """A company of v1 and the organization the load made, or would have made, for it."""
    organization_id: uuid.UUID
    name: str | None = None
    domain: str | None = None


@dataclass
class Invitation:
    id: uuid.UUID
    company: Company
    email: str
    role: str


def startup_companies(startup_rows) -> dict[str, Company]:
    """v1's identifier of each startup the load took, and the organization it became."""
    found = {}
    for row in startup_rows:
        # The names the startups' load knows these columns by.
        as_loaded = {"Company Name": row.get("company_name"), "Website": row.get("website"),
                     "Is Active": row.get("is_active"), "Brief Description": row.get("brief_description")}
        key, code = mapping.clean(row.get("id")), mapping.clean(row.get("startup_code"))
        if key is None or code is None or mapping.clean(row.get("company_name")) is None:
            continue
        if report.is_test_startup(as_loaded):
            continue
        found[key] = Company(records.ident("startup-organization", code),
                             domain=mapping.registrable_domain(report.website(as_loaded)))
    return found


def enterprise_companies(enterprise_rows) -> dict[str, Company]:
    """v1's identifier of each enterprise, its organization, and the name and website that tell the load which
    organization stands for it when its own was not created."""
    found = {}
    for row in enterprise_rows:
        organization = enterprises.profile(row)
        if organization is not None:
            found[mapping.clean(row.get("id"))] = Company(organization.id, organization.name,
                                                          mapping.registrable_domain(organization.website))
    return found


def invitations(representative_rows, company_column: str,
                companies: dict[str, Company]) -> tuple[list[Invitation], collections.Counter]:
    """An invitation for each person who is surely of a company the load took, and why the others get none.

    A person is surely the company's when their address is on its own website domain. Of those, the only one owns the
    company; of several, the one who founded or leads it does, the earliest to register when there are several or
    none, and the others are members.
    """
    left_out = collections.Counter()
    people = collections.defaultdict(list)
    for position, row in enumerate(representative_rows):
        company = mapping.clean(row.get(company_column))
        if company is None:
            continue
        if company not in companies:
            left_out["their company was not loaded (a test record, or one without a name)"] += 1
            continue
        email = (mapping.clean(row.get("email")) or "").lower()
        if not ADDRESS.match(email):
            left_out["no address that can receive an invitation"] += 1
            continue
        domain = mapping.registrable_domain("https://" + email.split("@")[1])
        if companies[company].domain is None:
            left_out["their company has no website of its own to tell whose it is"] += 1
            continue
        if domain in PUBLIC_MAIL or domain != companies[company].domain:
            left_out["the address is not on their company's website"] += 1
            continue
        leads = bool(LEADS.search(f"{row.get('position') or ''} {row.get('jobTitle') or ''}"))
        people[company].append((not leads, str(row.get("createdAt") or ""), position, mapping.clean(row.get("id")), email))
    found = []
    for company, members in people.items():
        seen = set()
        for rank, (_, _, _, key, email) in enumerate(sorted(members)):
            if email in seen:
                left_out["the address is on their company twice"] += 1
                continue
            seen.add(email)
            organization = companies[company].organization_id
            found.append(Invitation(records.ident("invitation", f"{organization}:{key}"), companies[company], email,
                                    "owner" if rank == 0 else "member"))
    return found, left_out


INVITE = enterprises.SAME_COMPANY + r"""
-- The organization that stands for a company whose own was not created: the one that has its website, or the one
-- that has its name when the person's address is on that organization's website. Null unless exactly one does.
create function pg_temp.same_company(its_name text, its_domain text, address text) returns uuid
language plpgsql as $$
declare
    found uuid[];
    mail text := split_part(address, '@', 2);
begin
    if its_domain is not null then
        select array_agg(o.id) into found from organization o
        where o.merged_into_id is null
          and (pg_temp.host(o.website) = its_domain or pg_temp.host(o.website) like '%.' || its_domain);
        if cardinality(found) = 1 then
            return found[1];
        end if;
    end if;
    if pg_temp.name_key(its_name) <> '' then
        select array_agg(o.id) into found from organization o
        where o.merged_into_id is null and pg_temp.name_key(o.name) = pg_temp.name_key(its_name)
          and pg_temp.host(o.website) <> ''
          and (pg_temp.host(o.website) = mail or pg_temp.host(o.website) like '%.' || mail
               or mail like '%.' || pg_temp.host(o.website));
        if cardinality(found) = 1 then
            return found[1];
        end if;
    end if;
    return null;
end $$;

do $$
declare
    person record;
    target uuid;
    stands_in boolean;
    reason text;
    written integer := 0;
begin
    for person in select * from legacy_person order by position loop
        -- An organization merged into another one since stands for that one.
        select coalesce(o.merged_into_id, o.id) into target from organization o where o.id = person.organization_id;
        stands_in := target is null and person.company_name is not null;
        if stands_in then
            target := pg_temp.same_company(person.company_name, person.company_domain, person.email);
        end if;
        reason := case
            when target is null and person.company_name is not null
                then 'no organization here is surely their company'
            when target is null then 'their organization is not here'
            when exists (select 1 from organization_invitation i where i.id = person.id) then 'loaded already'
            when exists (select 1 from identity_account a join organization_member m on m.account_id = a.id
                         where lower(a.email) = person.email) then 'the address belongs to an organization already'
            -- An operator runs the platform; a company's profile is not theirs to own through this load.
            when exists (select 1 from identity_account a
                         where lower(a.email) = person.email and a.platform_role = 'operator')
                then 'the address is an operator account'
            when exists (select 1 from organization_invitation i
                         where i.organization_id = target and lower(i.email) = person.email and i.status = 'pending')
                then 'the address is invited to it already'
        end;
        if reason is null then
            -- An organization that stands in for theirs, or that somebody owns or is invited to own already, takes
            -- them as a member.
            insert into organization_invitation (id, organization_id, email, role, invited_by_account_id,
                                                 sent_by_operator, expires_at)
            values (person.id, target, person.email,
                    case when stands_in
                           or exists (select 1 from organization_member m
                                      where m.organization_id = target and m.role = 'owner')
                           or exists (select 1 from organization_invitation i
                                      where i.organization_id = target and i.role = 'owner' and i.status = 'pending')
                         then 'member' else person.role end,
                    current_setting('legacy.operator')::uuid, true, now() + interval '100 years');
            written := written + 1;
            update legacy_person set stood_in = stands_in where id = person.id;
        else
            update legacy_person set outcome = reason where id = person.id;
        end if;
    end loop;
    raise notice 'legacy import: % people, % invitations written (% to own their organization, % to an organization that stands for theirs), % not written',
        (select count(*) from legacy_person), written,
        (select count(*) from organization_invitation i join legacy_person p on p.id = i.id
         where p.outcome is null and i.role = 'owner'),
        (select count(*) from legacy_person where stood_in),
        (select count(*) from legacy_person) - written;
end $$;

-- What was not written and why, as counts.
select outcome, count(*) from legacy_person where outcome is not null group by outcome order by outcome;
commit;
"""


def sql(found: list[Invitation]) -> str:
    lines = [
        "-- Invitations for the people of the old platform, built by infrastructure/legacy-import/people.py.",
        build.HEAD,
        "create temp table legacy_person (position integer primary key, id uuid not null, organization_id uuid not null, "
        "email text not null, role text not null, company_name text, company_domain text, outcome text, "
        "stood_in boolean not null default false) on commit drop;",
    ]
    for position, invitation in enumerate(found):
        company = invitation.company
        lines.append(
            "insert into legacy_person (position, id, organization_id, email, role, company_name, company_domain) values ("
            f"{position}, {build.lit(str(invitation.id))}, {build.lit(str(company.organization_id))}, "
            f"{build.lit(invitation.email)}, {build.lit(invitation.role)}, {build.lit(company.name)}, "
            f"{build.lit(company.domain)});")
    return "\n".join(lines) + INVITE


def counts(representatives, column: str, found: list[Invitation], left_out: collections.Counter) -> dict:
    return {
        "people": sum(1 for row in representatives if mapping.clean(row.get(column))),
        "invitations": len(found), "to_own": sum(1 for one in found if one.role == "owner"),
        "as_member": sum(1 for one in found if one.role == "member"),
        "organizations": len({one.company.organization_id for one in found}), "left_out": dict(left_out),
    }


def main(workbook_path: Path, out: Path) -> dict:
    workbook = openpyxl.load_workbook(workbook_path, read_only=True, data_only=True)
    representatives = report.sheet(workbook, "representatives")
    out.mkdir(parents=True, exist_ok=True)
    summary = {}
    for side, column, companies in (
            ("startup", "startupId", startup_companies(report.sheet(workbook, "startups"))),
            ("enterprise", "enterpriseId", enterprise_companies(report.sheet(workbook, "enterprises")))):
        found, left_out = invitations(representatives, column, companies)
        (out / f"{side}-invitations.sql").write_text(sql(found), encoding="utf-8", newline="\n")
        summary[side] = counts(representatives, column, found, left_out)
    return summary


if __name__ == "__main__":
    print(json.dumps(main(Path(sys.argv[1]), Path(sys.argv[2])), indent=2, ensure_ascii=False))
