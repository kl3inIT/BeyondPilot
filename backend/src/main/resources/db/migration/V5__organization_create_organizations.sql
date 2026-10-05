-- One company, team or builder on BeyondPilot. A person creates it and GenAI Fund reviews it (`status`); an operator
-- may also create it for a company that is not here yet, in which case it has no member until someone accepts the
-- invitation to own it.
create table organization (
    id                    uuid primary key,
    -- The address of its public page, derived from the name when it is created and fixed from then on.
    slug                  text        not null,
    name                  text        not null,
    -- What it does here: `provider` lists AI solutions, `enterprise` posts use cases. One or both.
    roles                 text[]      not null,
    type                  text        not null check (type in ('company', 'builder_team', 'independent_builder',
                                                               'other')),
    website               text,
    -- ISO 3166-1 alpha-2.
    country               text check (country ~ '^[A-Z]{2}$'),
    -- Null is unknown, never zero.
    team_size             text check (team_size in ('just_me', '2_9', '10_49', '50_99', '100_499', '500_999',
                                                    '1000_4999', '5000_plus')),
    description           text,
    -- The domain of the work address of the person who created or claimed it. An address on it may join without
    -- an invitation while `auto_join` is on. Null when that person used a public mail service.
    email_domain          text,
    auto_join             boolean     not null default true,
    status                text        not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    decision_reason       text check (decision_reason in ('duplicate', 'not_a_real_organization', 'incomplete',
                                                          'out_of_scope', 'other')),
    decision_message      text,
    decided_at            timestamptz,
    created_by_account_id uuid        not null references identity_account (id),
    version               bigint      not null default 0,
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now(),
    constraint organization_slug_key unique (slug),
    constraint organization_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    constraint organization_roles_known check (roles <@ array['provider', 'enterprise']::text[]
                                               and cardinality(roles) between 1 and 2)
);

-- One organization per domain: the second person with an address on it joins the first one's organization.
create unique index organization_email_domain_key on organization (email_domain) where email_domain is not null;

create index organization_status_idx on organization (status, created_at desc);

-- Who belongs to an organization. A person belongs to one organization at most.
create table organization_member (
    organization_id uuid        not null references organization (id) on delete cascade,
    account_id      uuid        not null references identity_account (id),
    role            text        not null check (role in ('owner', 'member')),
    job_title       text,
    created_at      timestamptz not null default now(),
    primary key (organization_id, account_id),
    constraint organization_member_account_id_key unique (account_id)
);

-- An owner, or an operator for an organization nobody owns yet, asks an address to join. The person who signs in
-- with that address sees the invitation; no link carries a secret.
create table organization_invitation (
    id                    uuid primary key,
    organization_id       uuid        not null references organization (id) on delete cascade,
    email                 text        not null,
    role                  text        not null check (role in ('owner', 'member')),
    invited_by_account_id uuid        not null references identity_account (id),
    status                text        not null default 'pending' check (status in ('pending', 'accepted', 'declined',
                                                                                  'revoked')),
    created_at            timestamptz not null default now(),
    decided_at            timestamptz
);

-- An address holds one open invitation of an organization.
create unique index organization_invitation_open_key on organization_invitation (organization_id, lower(email))
    where status = 'pending';

create index organization_invitation_email_idx on organization_invitation (lower(email)) where status = 'pending';

-- A person asks to join an organization. Its owners decide; while nobody owns it, the request is a claim and
-- GenAI Fund decides, and an approved claim makes the person its owner.
create table organization_join_request (
    id                    uuid primary key,
    organization_id       uuid        not null references organization (id) on delete cascade,
    account_id            uuid        not null references identity_account (id),
    message               text,
    status                text        not null default 'pending' check (status in ('pending', 'approved', 'declined',
                                                                                  'withdrawn')),
    decided_by_account_id uuid references identity_account (id),
    created_at            timestamptz not null default now(),
    decided_at            timestamptz
);

-- A person waits on one request at a time.
create unique index organization_join_request_open_key on organization_join_request (account_id)
    where status = 'pending';

create index organization_join_request_organization_idx on organization_join_request (organization_id)
    where status = 'pending';
