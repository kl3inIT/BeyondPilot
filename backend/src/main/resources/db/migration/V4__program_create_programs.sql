-- One program GenAI Fund runs. Its public page is built from these fields, written in the web application for its
-- address, or somewhere else (`page_kind`).
create table program (
    id            uuid primary key,
    -- The address under /programs. Free to change while the program has never been published.
    slug          text        not null,
    name          text        not null,
    type          text        not null check (type in ('enterprise_challenge', 'open_innovation_call', 'accelerator',
                                                       'hackathon', 'buildathon', 'grant', 'venture_building',
                                                       'pitch_competition', 'event_series', 'event')),
    -- A name until organizations exist; the link replaces it then.
    partner_name  text,
    summary       text,
    about         text,
    starts_on     date,
    ends_on       date,
    status        text        not null default 'draft' check (status in ('draft', 'published')),
    -- The first publication. From then on the address is fixed, published or not.
    published_at  timestamptz,
    page_kind     text        not null default 'standard' check (page_kind in ('standard', 'custom', 'external')),
    external_url  text,
    cover_file_id uuid references storage_file (id),
    -- When the program takes applications here. Both are null for a program that takes none.
    applications_open_at      timestamptz,
    applications_close_at     timestamptz,
    shortlist_size            integer check (shortlist_size > 0),
    outcomes_due_on           date,
    allow_updates_until_close boolean     not null default true,
    version       bigint      not null default 0,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    constraint program_slug_key unique (slug),
    -- A cover belongs to one program, which removes the file when it stops naming it.
    constraint program_cover_file_id_key unique (cover_file_id),
    constraint program_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
    constraint program_days_in_order check (starts_on is null or ends_on is null or starts_on <= ends_on),
    constraint program_window_whole check ((applications_open_at is null) = (applications_close_at is null)),
    constraint program_window_in_order check (applications_open_at < applications_close_at)
);

-- A dated step of a program that an applicant plans around. The list is kept in the order the operator gave it and
-- is replaced as a whole, so a row is known by its place.
create table program_milestone (
    program_id uuid        not null references program (id) on delete cascade,
    position   integer     not null,
    title      text        not null,
    starts_at  timestamptz not null,
    ends_at    timestamptz,
    all_day    boolean     not null default false,
    note       text,
    primary key (program_id, position),
    constraint program_milestone_times_in_order check (ends_at is null or starts_at <= ends_at)
);

-- A session of a program that people register for somewhere else. Kept like the milestones.
create table program_event (
    program_id       uuid        not null references program (id) on delete cascade,
    position         integer     not null,
    title            text        not null,
    starts_at        timestamptz not null,
    ends_at          timestamptz,
    online           boolean     not null default false,
    city             text,
    country          text,
    registration_url text,
    primary key (program_id, position),
    constraint program_event_times_in_order check (ends_at is null or starts_at <= ends_at)
);

-- The public list reads published programs.
create index program_status_idx on program (status);
