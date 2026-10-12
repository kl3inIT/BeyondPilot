"""The people of the old platform's full export, as invitations to the organization each one's company is here.

    python people.py <full-export.xlsx> <output directory>

Writes `<output>/startup-invitations.sql`: an operator's invitation for each person of a startup, to the organization
the startups' load made. Nobody gets an account and no email is sent: whoever signs in with the address sees the
invitation and accepts it. The invitation does not lapse. It takes the operator account as `-v operator=<uuid>` and
ends by counting what it did not write and why.
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
import mapping
import records
import report

ADDRESS = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Who founded or leads a company, in the position v1 offers and the job title a person types.
LEADS = re.compile(r"(?i)\b(co-?founder|founder|owner|ceo|chief executive)\b")


@dataclass
class Invitation:
    id: uuid.UUID
    organization_id: uuid.UUID
    email: str
    role: str


def startup_organizations(startup_rows) -> dict[str, uuid.UUID]:
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
        found[key] = records.ident("startup-organization", code)
    return found


def invitations(representative_rows, company_column: str,
                organizations: dict[str, uuid.UUID]) -> tuple[list[Invitation], collections.Counter]:
    """An invitation for each person of a company the load took, and why the others get none.

    The only person of a company owns it. Of several, the one who founded or leads it does, the earliest to register
    when there are several or none; the others are members.
    """
    left_out = collections.Counter()
    people = collections.defaultdict(list)
    for position, row in enumerate(representative_rows):
        company = mapping.clean(row.get(company_column))
        if company is None:
            continue
        if company not in organizations:
            left_out["their company was not loaded (a test record, or one without a name)"] += 1
            continue
        email = (mapping.clean(row.get("email")) or "").lower()
        if not ADDRESS.match(email):
            left_out["no address that can receive an invitation"] += 1
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
            organization = organizations[company]
            found.append(Invitation(records.ident("invitation", f"{organization}:{key}"), organization, email,
                                    "owner" if rank == 0 else "member"))
    return found, left_out


INVITE = r"""
do $$
declare
    person record;
    target uuid;
    reason text;
    written integer := 0;
begin
    for person in select * from legacy_person order by position loop
        -- An organization merged into another one since stands for that one.
        select coalesce(o.merged_into_id, o.id) into target from organization o where o.id = person.organization_id;
        reason := case
            when target is null then 'their organization is not here'
            when exists (select 1 from organization_invitation i where i.id = person.id) then 'loaded already'
            when exists (select 1 from identity_account a join organization_member m on m.account_id = a.id
                         where lower(a.email) = person.email) then 'the address belongs to an organization already'
            when exists (select 1 from organization_invitation i
                         where i.organization_id = target and lower(i.email) = person.email and i.status = 'pending')
                then 'the address is invited to it already'
        end;
        if reason is null then
            -- An organization somebody owns already takes the others as members.
            insert into organization_invitation (id, organization_id, email, role, invited_by_account_id,
                                                 sent_by_operator, expires_at)
            values (person.id, target, person.email,
                    case when exists (select 1 from organization_member m
                                      where m.organization_id = target and m.role = 'owner') then 'member'
                         else person.role end,
                    current_setting('legacy.operator')::uuid, true, now() + interval '100 years');
            written := written + 1;
        else
            update legacy_person set outcome = reason where id = person.id;
        end if;
    end loop;
    raise notice 'legacy import: % people, % invitations written (% to own their organization), % not written',
        (select count(*) from legacy_person), written,
        (select count(*) from organization_invitation i join legacy_person p on p.id = i.id
         where p.outcome is null and i.role = 'owner'),
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
        "email text not null, role text not null, outcome text) on commit drop;",
    ]
    for position, invitation in enumerate(found):
        lines.append(
            f"insert into legacy_person values ({position}, {build.lit(str(invitation.id))}, "
            f"{build.lit(str(invitation.organization_id))}, {build.lit(invitation.email)}, "
            f"{build.lit(invitation.role)}, null);")
    return "\n".join(lines) + INVITE


def main(workbook_path: Path, out: Path) -> dict:
    workbook = openpyxl.load_workbook(workbook_path, read_only=True, data_only=True)
    representatives = report.sheet(workbook, "representatives")
    found, left_out = invitations(representatives, "startupId", startup_organizations(report.sheet(workbook, "startups")))
    out.mkdir(parents=True, exist_ok=True)
    (out / "startup-invitations.sql").write_text(sql(found), encoding="utf-8", newline="\n")
    return {
        "people_of_startups": sum(1 for row in representatives if mapping.clean(row.get("startupId"))),
        "invitations": len(found), "to_own": sum(1 for one in found if one.role == "owner"),
        "as_member": sum(1 for one in found if one.role == "member"),
        "organizations": len({one.organization_id for one in found}), "left_out": dict(left_out),
    }


if __name__ == "__main__":
    print(json.dumps(main(Path(sys.argv[1]), Path(sys.argv[2])), indent=2, ensure_ascii=False))
