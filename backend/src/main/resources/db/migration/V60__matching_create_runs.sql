-- Matching (BEY-39): the solutions that fit a use case, with the reasons. The matching module owns these tables.

-- The requirements of a use case as last extracted from its brief and its attached files.
create table matching_requirement (
    use_case_id uuid    not null,
    -- The place in the list, from 1: capabilities first. A finding names its requirement by it.
    position    integer not null,
    kind        text    not null,
    necessity   text    not null,
    -- One sentence in neutral words.
    statement   text    not null,
    -- The words of the brief the requirement comes from; empty when the model's quote was not found there.
    quote       text    not null,
    -- The fingerprint of what the list was extracted from: the brief, its attached files and the prompt version.
    -- The list is replaced together when it changes.
    source_hash text    not null,
    primary key (use_case_id, position),
    constraint matching_requirement_kind check (kind in ('capability', 'constraint')),
    constraint matching_requirement_necessity check (necessity in ('required', 'optional'))
);

-- One pass of matching for one use case.
create table matching_run (
    id                    uuid primary key default gen_random_uuid(),
    use_case_id           uuid        not null,
    -- queued: waits for the worker. running: the worker has it. waiting: the provider refused, it continues at
    -- resume_at. done, failed: ended.
    state                 text        not null default 'queued',
    -- approved: started because the use case was approved or changed. operator: started by a person.
    origin                text        not null,
    started_by_account_id uuid,
    prompt_version        integer     not null,
    -- The model that judged, as its provider names it; null until the run reaches a model.
    model_name            text,
    -- How many times in a row the run stopped at a refusal without judging anything in between.
    stalls                integer     not null default 0,
    resume_at             timestamptz,
    -- The kind of failure, never a provider's message.
    failure               text,
    created_at            timestamptz not null default now(),
    started_at            timestamptz,
    ended_at              timestamptz,
    constraint matching_run_state check (state in ('queued', 'running', 'waiting', 'done', 'failed')),
    constraint matching_run_origin check (origin in ('approved', 'operator'))
);

-- At most one run of a use case that has not ended.
create unique index matching_run_open_idx on matching_run (use_case_id)
    where state in ('queued', 'running', 'waiting');
create index matching_run_use_case_idx on matching_run (use_case_id, created_at desc);

-- One step of a run, for the operators' view of how it worked.
create table matching_run_step (
    run_id        uuid    not null references matching_run (id) on delete cascade,
    -- requirements, candidates or judgment.
    name          text    not null,
    position      integer not null,
    taken_in      integer not null default 0,
    given_out     integer not null default 0,
    calls         integer not null default 0,
    input_tokens  bigint  not null default 0,
    output_tokens bigint  not null default 0,
    millis        bigint  not null default 0,
    primary key (run_id, name)
);

-- One solution for one use case.
create table matching_candidate (
    id                uuid primary key default gen_random_uuid(),
    use_case_id       uuid        not null,
    solution_id       uuid        not null,
    -- recommended: found by a run. added: put there by an operator.
    origin            text        not null,
    -- Where the last run found it among its candidates, from 1; null when no run found it.
    found_at          integer,
    bucket            text        not null default 'none',
    required_met      integer     not null default 0,
    required_total    integer     not null default 0,
    -- What the model found per requirement and for the industry and the technology, each with its quote, its source
    -- and whether code found the quote there.
    findings          jsonb       not null default '{}',
    -- The model's one sentence: the strongest reason, or what is missing.
    summary           text,
    -- Which sources held no text to read: "deck", "website".
    unread            text[]      not null default '{}',
    -- What was judged: the requirements and the solution's sources. The next run judges again only when it differs.
    fingerprint       text,
    run_id            uuid,
    judged_at         timestamptz,
    created_at        timestamptz not null default now(),
    constraint matching_candidate_once unique (use_case_id, solution_id),
    constraint matching_candidate_origin check (origin in ('recommended', 'added')),
    constraint matching_candidate_bucket check (bucket in ('direct', 'industry', 'technology', 'none'))
);

-- What people did with a candidate. Nothing here is changed or removed; the last row is the candidate's state.
create table matching_decision (
    id           uuid primary key default gen_random_uuid(),
    candidate_id uuid        not null references matching_candidate (id) on delete cascade,
    kind         text        not null,
    reason       text,
    note         text,
    account_id   uuid        not null,
    created_at   timestamptz not null default now(),
    constraint matching_decision_kind check (kind in ('shortlisted', 'removed', 'restored'))
);

create index matching_decision_candidate_idx on matching_decision (candidate_id, created_at desc);
