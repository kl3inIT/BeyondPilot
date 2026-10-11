-- A provider organization's proposal to a use case (BEY-133): one per organization and use case. The working copy is
-- what the form holds now; sending keeps the sender's talent profile as it was, so a later change to the profile
-- leaves the proposal as sent. The table `proposal` is a person's application to a program, which this is not.
create table use_case_proposal (
    id                         uuid primary key,
    use_case_id                uuid        not null references use_case (id),
    organization_id            uuid        not null references organization (id),
    created_by_account_id      uuid        not null references identity_account (id),
    sent_by_account_id         uuid references identity_account (id),
    solution_id                uuid references solution (id),
    approach                   text,
    deck_file_id               uuid references storage_file (id),
    -- One of the members below; the service keeps it so, since the member rows are replaced with each save.
    primary_contact_account_id uuid references identity_account (id),
    status                     text        not null default 'draft' check (status in ('draft', 'sent')),
    -- The sender's profile when the proposal was sent, without what the profile keeps private.
    talent                     jsonb check (talent is null or jsonb_typeof(talent) = 'object'),
    sent_at                    timestamptz,
    version                    bigint      not null default 0,
    created_at                 timestamptz not null default now(),
    updated_at                 timestamptz not null default now(),
    constraint use_case_proposal_organization_key unique (use_case_id, organization_id),
    constraint use_case_proposal_sent_has_snapshot check ((status = 'sent') = (talent is not null and sent_at is not null))
);

create index use_case_proposal_sent_idx on use_case_proposal (use_case_id) where status = 'sent';

create index use_case_proposal_organization_idx on use_case_proposal (organization_id);

-- The people of the provider organization the proposal names, with the role typed for it.
create table use_case_proposal_member (
    proposal_id uuid    not null references use_case_proposal (id) on delete cascade,
    account_id  uuid    not null references identity_account (id),
    position    integer not null,
    role        text    not null default '',
    primary key (proposal_id, account_id)
);
