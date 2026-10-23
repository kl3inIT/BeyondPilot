-- Perks (BEY-247): what an organization gives to members of BeyondPilot, such as credits or a free plan, with who may
-- get it, how, until when, and the claims of the teams that got it. The offers of BEY-148 and BEY-217 become perks:
-- each keeps its partner, title, address, solutions and GenAI Fund's mark, and is published for everyone as a link.

alter table offer rename to perk;
alter table perk rename constraint offer_pkey to perk_pkey;
alter table perk rename constraint offer_organization_id_fkey to perk_organization_id_fkey;
alter index offer_organization_id_idx rename to perk_organization_id_idx;

alter table solution_offer rename to perk_solution;
alter table perk_solution rename column offer_id to perk_id;
alter table perk_solution rename constraint solution_offer_pkey to perk_solution_pkey;
alter table perk_solution rename constraint solution_offer_solution_id_fkey to perk_solution_solution_id_fkey;
alter table perk_solution rename constraint solution_offer_offer_id_fkey to perk_solution_perk_id_fkey;
alter index solution_offer_offer_id_idx rename to perk_solution_perk_id_idx;
-- A perk names the solutions it goes with; deleting the perk takes those lines with it.
alter table perk_solution drop constraint perk_solution_perk_id_fkey;
alter table perk_solution add constraint perk_solution_perk_id_fkey foreign key (perk_id) references perk (id) on delete cascade;

-- Dates, places and the archive say when a perk stops; closing an offer to new solutions has no meaning left.
alter table perk drop column closed_at;

-- The address is the link of a link perk and nothing else now.
alter table perk drop constraint offer_url_check;
alter table perk alter column url drop not null;
alter table perk add constraint perk_url_check
    check (url is null or (url ~ '^https://[^[:space:]]+$' and char_length(url) <= 2048));
alter table perk rename constraint offer_title_check to perk_title_check;

alter table perk
    -- Its address on the site, /solutions/perks/{slug}.
    add column slug             text,
    -- The figure its card shows large, such as "$1,000" or "3 months free".
    add column value            text check (value is null or char_length(value) between 1 and 40),
    add column summary          text check (summary is null or char_length(summary) between 1 and 200),
    add column about            text check (about is null or char_length(about) between 1 and 4000),
    -- How to get it, in order: an array of up to ten strings.
    add column steps            jsonb       not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
    add column terms            text check (terms is null or char_length(terms) between 1 and 4000),
    add column terms_url        text check (terms_url is null or (terms_url ~ '^https://[^[:space:]]+$'
                                                                  and char_length(terms_url) <= 2048)),
    -- Who may get it: everyone, members (signed in, in an organization), a program's applicants, or a program's
    -- shortlist once its outcomes are released.
    add column audience         text        not null default 'everyone'
        check (audience in ('everyone', 'members', 'applicants', 'shortlisted')),
    add column program_id       uuid references program (id),
    -- How it is got: a link to the partner, a code GenAI Fund holds for the audience, a code of the team's own from a
    -- list, or a request answering the partner's questions.
    add column way              text        not null default 'link' check (way in ('link', 'code', 'codes', 'request')),
    add column code             text check (code is null or char_length(code) between 1 and 200),
    add column redeem_url       text check (redeem_url is null or (redeem_url ~ '^https://[^[:space:]]+$'
                                                                    and char_length(redeem_url) <= 2048)),
    -- A request's questions: an array of {id, label, multiline, required}.
    add column questions        jsonb       not null default '[]'::jsonb check (jsonb_typeof(questions) = 'array'),
    -- Whether the partner grants or declines each request; otherwise a request is granted when it is sent.
    add column require_approval boolean     not null default true,
    -- Got once per person rather than once per organization.
    add column per_person       boolean     not null default false,
    -- How many claims it takes; null for as many as come.
    add column places           integer check (places is null or places between 1 and 100000),
    add column starts_at        timestamptz,
    add column ends_at          timestamptz,
    add column state            text        not null default 'draft' check (state in ('draft', 'published', 'archived')),
    add column published_at     timestamptz,
    add constraint perk_program_check
        check ((audience in ('applicants', 'shortlisted')) = (program_id is not null)),
    add constraint perk_dates_check check (starts_at is null or ends_at is null or starts_at < ends_at),
    add constraint perk_published_check check (state <> 'published' or published_at is not null);

-- Every offer is published as a link for everyone, under a slug from its organization and title.
update perk p
set slug         = trim(both '-' from left(regexp_replace(lower(o.slug || '-' || p.title), '[^a-z0-9]+', '-', 'g'), 100))
                       || '-' || left(p.id::text, 6),
    state        = 'published',
    published_at = p.created_at
from organization o
where o.id = p.organization_id;

alter table perk alter column slug set not null;
alter table perk add constraint perk_slug_key unique (slug);
alter table perk add constraint perk_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120);
alter table perk add constraint perk_way_link_check check (way <> 'link' or url is not null);
alter table perk add constraint perk_way_code_check check ((way = 'code') = (code is not null));

-- The catalogue reads the published perks by their dates.
create index perk_state_idx on perk (state, ends_at);
create index perk_program_id_idx on perk (program_id) where program_id is not null;

-- A perk an operator shows on a program's page beside the ones for that program's teams.
create table perk_program (
    perk_id    uuid        not null references perk (id) on delete cascade,
    program_id uuid        not null references program (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (perk_id, program_id)
);

create index perk_program_program_id_idx on perk_program (program_id);

-- One getting of a perk by a person for their organization: a link opened, a code shown, or a request sent.
create table perk_claim (
    id                    uuid primary key,
    perk_id               uuid        not null references perk (id),
    organization_id       uuid        not null references organization (id),
    account_id            uuid        not null references identity_account (id),
    -- taken for a link or a code; a request is waiting, granted or declined.
    state                 text        not null check (state in ('taken', 'waiting', 'granted', 'declined')),
    -- The code it got: the shared code as it was, or the one of the list kept for it.
    code                  text,
    -- A request's answers, by question identifier.
    answers               jsonb       not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
    decided_by_account_id uuid references identity_account (id),
    decided_at            timestamptz,
    version               bigint      not null default 0,
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now(),
    -- A request granted when it was sent has a time and nobody who decided.
    constraint perk_claim_decided_check check ((state in ('granted', 'declined')) = (decided_at is not null))
);

create index perk_claim_perk_idx on perk_claim (perk_id, state);
create index perk_claim_organization_idx on perk_claim (organization_id, created_at desc);
create index perk_claim_account_idx on perk_claim (account_id);

-- The single-use codes a partner gave for a perk of the way 'codes', each given to one claim.
create table perk_code (
    id         uuid primary key,
    perk_id    uuid        not null references perk (id) on delete cascade,
    code       text        not null check (char_length(code) between 1 and 200),
    claim_id   uuid unique references perk_claim (id),
    created_at timestamptz not null default now(),
    constraint perk_code_key unique (perk_id, code)
);

-- The next free code of a perk is read in the order the codes were loaded.
create index perk_code_free_idx on perk_code (perk_id, created_at) where claim_id is null;
