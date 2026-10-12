-- An offer a solution comes with, such as cloud credits: one line that names it and the page where it is claimed.
-- GenAI Fund keeps a list every solution chooses from, and an organization writes offers of its own, which only its
-- solutions come with.
create table offer (
    id              uuid primary key,
    -- Null is an offer of GenAI Fund's list; otherwise the organization that wrote it and whose solutions may choose it.
    organization_id uuid references organization (id),
    title           text        not null check (char_length(title) between 1 and 80),
    -- A card links to it straight away, so it is an https address and nothing else.
    url             text        not null check (url ~ '^https://[^[:space:]]+$' and char_length(url) <= 2048),
    version         bigint      not null default 0,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- Two offers of GenAI Fund's list that read the same could not be told apart where one is chosen. An organization's
-- own are kept apart by the service only, so that merging two organizations never fails on a title both wrote.
create unique index offer_title_key on offer (lower(title)) where organization_id is null;

-- An editor reads the offers of its organization beside GenAI Fund's.
create index offer_organization_id_idx on offer (organization_id);

-- The offers a solution comes with. One offer goes with many solutions, and it is not deleted while one names it.
create table solution_offer (
    solution_id uuid not null references solution (id) on delete cascade,
    offer_id    uuid not null references offer (id),
    primary key (solution_id, offer_id)
);

-- The operators' list counts the solutions of each offer.
create index solution_offer_offer_id_idx on solution_offer (offer_id);
