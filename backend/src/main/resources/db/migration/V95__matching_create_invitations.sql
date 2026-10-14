-- A provider that matching recommended for a use case, invited to propose by a person (BEY-105). One invitation for each
-- use case and provider organization, ever: it was emailed and cannot be taken back. The candidate is the solution the
-- invitation was sent from; the invitation stays when a later run no longer finds that solution.
create table matching_invitation (
    id              uuid primary key default gen_random_uuid(),
    use_case_id     uuid        not null,
    organization_id uuid        not null,
    candidate_id    uuid        not null,
    note            text,
    account_id      uuid        not null,
    by_operator     boolean     not null default false,
    created_at      timestamptz not null default now(),
    constraint matching_invitation_note check (note is null or char_length(note) between 1 and 500)
);

create unique index matching_invitation_once on matching_invitation (use_case_id, organization_id);
create index matching_invitation_account_idx on matching_invitation (use_case_id, account_id, created_at);
