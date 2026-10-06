-- A person's application to a program (BEY-37): one per person and program. The working copy is what the form holds
-- now; each submission adds a version that keeps what it was given, so a later change to a profile leaves it as sent.
create table proposal (
    id              uuid primary key,
    program_id      uuid        not null references program (id),
    account_id      uuid        not null references identity_account (id),
    -- Who applies: the applicant's organization, set once they belong to one.
    organization_id uuid references organization (id),
    solution_id     uuid references solution (id),
    status          text        not null default 'draft' check (status in ('draft', 'submitted', 'withdrawn')),
    -- First and last name, phone, country and LinkedIn, as the applicant typed them.
    contact         jsonb       not null default '{}'::jsonb,
    team_background text,
    -- What the applicant brings for this application: the deck (a private PDF), what the solution is built with and
    -- its traction so far. The next application starts from them.
    deck_file_id    uuid references storage_file (id),
    built_with      text[]      not null default '{}',
    traction        text,
    -- The answers to the program's questions, by question identifier.
    answers         jsonb       not null default '{}'::jsonb,
    -- How many times it was submitted; the latest version is what reviewers read.
    submissions     integer     not null default 0,
    submitted_at    timestamptz,
    withdrawn_at    timestamptz,
    version         bigint      not null default 0,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    constraint proposal_program_account_key unique (program_id, account_id),
    constraint proposal_contact_object check (jsonb_typeof(contact) = 'object'),
    constraint proposal_answers_object check (jsonb_typeof(answers) = 'object')
);

create index proposal_account_idx on proposal (account_id, updated_at desc);

create index proposal_program_organization_idx on proposal (program_id, organization_id) where status = 'submitted';

-- What one submission held: the applicant, the organization, the solution and the answers, as they were.
create table proposal_version (
    proposal_id  uuid        not null references proposal (id) on delete cascade,
    number       integer     not null,
    submitted_at timestamptz not null,
    snapshot     jsonb       not null,
    primary key (proposal_id, number)
);
