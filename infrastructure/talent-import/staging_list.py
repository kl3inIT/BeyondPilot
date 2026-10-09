"""Approves and lists fifty of the imported profiles on staging, so the directory is seen with real people.

Staging only: production shows none of them until GenAI Fund decides (design, decisions 3 and 4). Their addresses
are suppressed first, so no enquiry or other email of staging reaches a person who has never heard of BeyondPilot.

    python staging_list.py <registrations.xlsx> > staging-list.sql

The fifty are the same on every run: among the profiles that state a company, a LinkedIn link and more than a few
words of work, so many of each role, in the order of their identifiers.
"""

import sys
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))  # run with -I, so the folder is added explicitly

import records

# How many of each role are shown; fifty in all.
SHOWN = {"software_engineer": 20, "student": 8, "founder": 8, "researcher": 5, "solution_architect": 4, "other": 5}

# A project told in fewer characters than this says too little to show.
TOLD = 40


def shown(profiles: list[records.Profile]) -> list[records.Profile]:
    full = sorted((p for p in profiles
                   if p.works_at and p.website and (p.project.summary or len(p.project.title) >= TOLD)),
                  key=lambda p: str(p.id))
    chosen = []
    for role, count in SHOWN.items():
        chosen += [p for p in full if p.roles == [role]][:count]
    return sorted(chosen, key=lambda p: p.email)


def main() -> None:
    read = records.read(openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True))
    chosen = shown(read.profiles)
    addresses = ",\n    ".join(f"('{p.email.replace(chr(39), chr(39) * 2)}')" for p in chosen)
    ids = ",\n    ".join(f"('{p.id}'::uuid)" for p in chosen)
    print(f"""-- Staging only: suppress the addresses of {len(chosen)} imported people, then approve and list their profiles.
-- Run after load.sql, then rebuild the search index.
\\set ON_ERROR_STOP on
begin;

insert into email_suppression (address, reason, created_by_label)
select address, 'manual', 'AABW talent import' from (values
    {addresses}) shown(address)
on conflict (address) do nothing;

update talent_profile t set status = 'approved', listed = true, submitted_at = now(), decided_at = now(),
                            updated_at = now()
from (values
    {ids}) shown(id)
where t.id = shown.id and t.status = 'draft';

do $$
begin
    raise notice 'aabw staging: % profiles approved and listed',
        (select count(*) from talent_profile t join email_suppression s on s.created_by_label = 'AABW talent import'
             join identity_account a on a.id = t.account_id and lower(a.email) = s.address
         where t.status = 'approved' and t.listed);
end $$;
commit;""")


if __name__ == "__main__":
    main()
