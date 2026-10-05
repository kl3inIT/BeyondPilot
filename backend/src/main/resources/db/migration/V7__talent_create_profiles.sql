-- The professional profile of one person. They write it as a draft and submit it; GenAI Fund approves it before anyone
-- else sees it. Approval and listing are separate: an approved profile may be kept out of the public directory.
create table talent_profile (
    id               uuid primary key,
    account_id       uuid        not null references identity_account (id),
    -- The address under /talent, derived from the name when the profile is created and fixed from then on.
    slug             text        not null,
    name             text        not null,
    headline         text,
    bio              text,
    roles            text[]      not null default '{}',
    skills           text[]      not null default '{}',
    country          text check (country ~ '^[A-Z]{2}$'),
    availability     text check (availability in ('available', 'open_to_offers', 'not_available')),
    engagement       text[]      not null default '{}',
    -- US dollars an hour. Null is not stated.
    rate_band        text check (rate_band in ('under_25', '25_50', '50_100', '100_150', '150_plus')),
    website          text,
    status           text        not null default 'draft' check (status in ('draft', 'submitted', 'approved',
                                                                           'rejected')),
    decision_reason  text check (decision_reason in ('incomplete', 'unverifiable', 'inappropriate', 'other')),
    decision_message text,
    decided_at       timestamptz,
    submitted_at     timestamptz,
    listed           boolean     not null default true,
    version          bigint      not null default 0,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    -- A person has one profile.
    constraint talent_profile_account_id_key unique (account_id),
    constraint talent_profile_slug_key unique (slug),
    constraint talent_profile_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    constraint talent_profile_engagement_known check (engagement <@ array['full_time', 'part_time', 'contract',
                                                                          'advisory']::text[])
);

-- The public directory reads approved, listed profiles and narrows them by role.
create index talent_profile_public_idx on talent_profile (name) where status = 'approved' and listed;
create index talent_profile_roles_idx on talent_profile using gin (roles);

-- The operators' list reads those waiting for review first.
create index talent_profile_status_idx on talent_profile (status, submitted_at);

-- The work a person shows on their profile, in the order they put it.
create table talent_project (
    id         uuid primary key,
    profile_id uuid    not null references talent_profile (id) on delete cascade,
    position   integer not null,
    title      text    not null,
    summary    text,
    url        text,
    year       integer check (year between 1990 and 2100),
    constraint talent_project_position_key unique (profile_id, position)
);

-- A message someone signed in sent through a profile. The person answers its sender by email.
create table talent_enquiry (
    id                uuid primary key,
    profile_id        uuid        not null references talent_profile (id) on delete cascade,
    sender_account_id uuid        not null references identity_account (id),
    message           text        not null,
    created_at        timestamptz not null default now()
);

create index talent_enquiry_profile_id_idx on talent_enquiry (profile_id, created_at desc);
create index talent_enquiry_sender_idx on talent_enquiry (sender_account_id, profile_id, created_at desc);
