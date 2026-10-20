-- Matching (BEY-229): a run also judges the proposals a use case received against its requirements, and keeps one
-- evaluation per proposal. A proposal sent or edited queues a run of its own origin.
alter table matching_run drop constraint matching_run_origin;
alter table matching_run add constraint matching_run_origin
    check (origin in ('approved', 'operator', 'member', 'proposal'));

create table matching_proposal (
    -- The proposal, as the proposal module names it; one evaluation each, replaced when it is judged again.
    proposal_id    uuid primary key,
    use_case_id    uuid        not null,
    -- When the proposal was sent, or last edited after that, as it was when it was judged.
    stamp          timestamptz not null,
    required_met   integer     not null,
    required_total integer     not null,
    -- What the model found per requirement and for the problem, each with its quote, its source and whether code
    -- found the quote there, as a candidate's findings.
    findings       jsonb       not null,
    -- The model's one sentence: the strongest reason, or what is missing.
    summary        text,
    -- Which sources held no text to read: "proposal_deck".
    unread         text[]      not null default '{}',
    -- What was judged: the prompt version, the requirements and every text read. The next run judges again only
    -- when it differs.
    fingerprint    text        not null,
    run_id         uuid        not null,
    judged_at      timestamptz not null default now()
);

create index matching_proposal_use_case_idx on matching_proposal (use_case_id);
