-- One request for an introduction to the organization behind a solution. The provider's owners answer it; neither side
-- learns the other's email address before that. The rows name the sender's organization as it was when they asked.
create table introduction_request (
    id                       uuid primary key,
    solution_id              uuid        not null references solution (id),
    -- The name the solution had when it was asked about, so the provider reads what the sender read.
    solution_name            text        not null,
    provider_organization_id uuid        not null references organization (id),
    sender_account_id        uuid        not null references identity_account (id),
    sender_organization_id   uuid        not null references organization (id),
    message                  text        not null,
    status                   text        not null default 'pending' check (status in ('pending', 'replied',
                                                                                      'declined')),
    created_at               timestamptz not null default now(),
    answered_at              timestamptz,
    answered_by_account_id   uuid references identity_account (id)
);
-- A person has at most one waiting request to a solution.
create unique index introduction_request_pending_key on introduction_request (sender_account_id, solution_id)
    where status = 'pending';
create index introduction_request_provider_idx on introduction_request (provider_organization_id, created_at desc);
