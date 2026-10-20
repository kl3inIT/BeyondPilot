-- Evaluation (BEY-234): for every submission to a program, a suggested shortlist tier with the evidence behind it,
-- after Kai's shortlisting methodology. The matching module owns these tables. Nothing here decides: the operators'
-- decisions stay on the applications and the proposals.

-- One pass over the candidates of one program.
create table evaluation_run (
    id                    uuid primary key default gen_random_uuid(),
    program_id            uuid        not null,
    -- queued: waits for the worker. running: the worker has it. waiting: the provider refused, it continues at
    -- resume_at. done, failed: ended.
    state                 text        not null default 'queued',
    -- change: queued because a submission, a use case or a brief changed. operator: started by a person.
    origin                text        not null,
    started_by_account_id uuid,
    prompt_version        integer     not null,
    -- The model that assessed, as its provider names it; null until the run reaches a model.
    model_name            text,
    -- How many times in a row the run stopped at a refusal without assessing anything in between.
    stalls                integer     not null default 0,
    resume_at             timestamptz,
    -- A run a change asked for starts only once the program has stayed unchanged until this moment.
    not_before            timestamptz,
    -- An operator asked for every candidate to be assessed again, whatever was assessed before.
    assess_all            boolean     not null default false,
    -- The kind of failure, never a provider's message.
    failure               text,
    -- How many candidates the run assessed or found unchanged, of how many it gathered.
    assessed              integer     not null default 0,
    total                 integer     not null default 0,
    created_at            timestamptz not null default now(),
    started_at            timestamptz,
    ended_at              timestamptz,
    constraint evaluation_run_state check (state in ('queued', 'running', 'waiting', 'done', 'failed')),
    constraint evaluation_run_origin check (origin in ('change', 'operator'))
);

-- At most one run of a program that has not ended.
create unique index evaluation_run_open_idx on evaluation_run (program_id)
    where state in ('queued', 'running', 'waiting');
create index evaluation_run_program_idx on evaluation_run (program_id, created_at desc);

-- One step of a run, for the operators' view of how it worked and what it cost.
create table evaluation_run_step (
    run_id        uuid    not null references evaluation_run (id) on delete cascade,
    -- candidates or assessment.
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

-- What the model suggested for one candidate: an organization with one solution, through every route it used. Rows are
-- never changed; a new assessment is added when what was read changes, and the latest is the candidate's current one.
create table evaluation_assessment (
    id              uuid primary key default gen_random_uuid(),
    program_id      uuid        not null,
    organization_id uuid        not null,
    solution_id     uuid        not null,
    -- The records read, as their modules name them: kind (application, proposal), id, and the version or the time
    -- it was sent, so that an edit after the assessment shows.
    records         jsonb       not null,
    -- What was read: the prompt version, the use cases' requirements and every text read. The next run assesses
    -- again only when it differs.
    fingerprint     text        not null,
    tier            text        not null,
    alignment       text        not null,
    -- The tier waits on a demonstration or a clarification not seen yet.
    provisional     boolean     not null default false,
    -- why, concern, next, rationale, contradictions, questions.
    notes           jsonb       not null,
    -- The six criteria, each with its findings: label, summary, finding, gap, sources, quote, and whether code
    -- found the quote in what was read.
    criteria        jsonb       not null,
    -- The proposal gate and the early-stage route.
    gate            jsonb       not null,
    -- Each record and file read: pages read of pages held, pages unread and why, identical files counted once.
    coverage        jsonb       not null,
    -- Why the tier differs from the candidate's previous assessment, when it does.
    change_note     text,
    run_id          uuid        not null,
    model_name      text        not null,
    prompt_version  integer     not null,
    assessed_at     timestamptz not null default now(),
    constraint evaluation_assessment_once unique (program_id, organization_id, solution_id, fingerprint),
    constraint evaluation_assessment_tier
        check (tier in ('strong_match', 'potential_match', 'to_consider', 'strong_no')),
    constraint evaluation_assessment_alignment check (alignment in ('direct', 'industry', 'technology', 'none'))
);

create index evaluation_assessment_candidate_idx
    on evaluation_assessment (program_id, organization_id, solution_id, assessed_at desc);
