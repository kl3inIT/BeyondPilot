-- One AI solution an organization offers. Its owners write it as a draft and submit it; GenAI Fund approves it before
-- anyone else sees it. Approval and listing are separate: an approved solution may be kept out of the public list.
create table solution (
    id                    uuid primary key,
    organization_id       uuid        not null references organization (id),
    -- The address under /solutions, derived from the name when it is created and fixed from then on.
    slug                  text        not null,
    name                  text        not null,
    summary               text,
    problems_solved       text,
    value_proposition     text,
    focus_areas           text[]      not null default '{}',
    industries            text[]      not null default '{}',
    -- Null is unknown.
    maturity              text check (maturity in ('idea', 'prototype', 'pilot', 'production', 'scaled')),
    deployment            text[]      not null default '{}',
    website               text,
    status                text        not null default 'draft' check (status in ('draft', 'submitted', 'approved',
                                                                                'rejected')),
    decision_reason       text check (decision_reason in ('incomplete', 'not_an_ai_solution', 'duplicate',
                                                          'unverifiable', 'other')),
    decision_message      text,
    decided_at            timestamptz,
    submitted_at          timestamptz,
    listed                boolean     not null default true,
    created_by_account_id uuid        not null references identity_account (id),
    version               bigint      not null default 0,
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now(),
    constraint solution_slug_key unique (slug),
    constraint solution_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    constraint solution_deployment_known check (deployment <@ array['cloud_saas', 'private_cloud', 'on_premise',
                                                                    'hybrid']::text[])
);

create index solution_organization_id_idx on solution (organization_id);

-- The public list reads approved, listed solutions and narrows them by facet.
create index solution_public_idx on solution (name) where status = 'approved' and listed;
create index solution_industries_idx on solution using gin (industries);
create index solution_focus_areas_idx on solution using gin (focus_areas);

-- The operators' list reads those waiting for review first.
create index solution_status_idx on solution (status, submitted_at);
