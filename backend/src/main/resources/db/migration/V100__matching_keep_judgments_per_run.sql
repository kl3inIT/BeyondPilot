-- Matching (BEY-210): the group each solution had in each run, so that operators read what changed between two runs
-- of a use case. A candidate keeps only its last judgment; this keeps one line per run and solution, written when the
-- run judges the solution or finds it unchanged since its last judgment. Runs before this migration have none.
create table matching_judgment (
    run_id         uuid        not null references matching_run (id) on delete cascade,
    solution_id    uuid        not null,
    bucket         text        not null,
    required_met   integer     not null,
    required_total integer     not null,
    -- false when the run found the solution's material unchanged and kept its earlier judgment.
    judged         boolean     not null,
    recorded_at    timestamptz not null default now(),
    primary key (run_id, solution_id),
    constraint matching_judgment_bucket check (bucket in ('direct', 'industry', 'technology', 'none'))
);
