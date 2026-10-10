-- Matching (BEY-106): what people say about the group the AI gave a candidate. The matching module owns this table.

-- One person's answer about one judgment of one candidate. Nothing here is changed or removed: answering again adds
-- a row, and the last row of a person about a judgment is their answer. It decides nothing in the list.
create table matching_feedback (
    id              uuid primary key default gen_random_uuid(),
    candidate_id    uuid        not null references matching_candidate (id) on delete cascade,
    account_id      uuid        not null,
    -- The judgment the answer is about: the candidate's fingerprint when the answer was given. A candidate judged
    -- again from other material has another fingerprint, and the question is asked again.
    fingerprint     text        not null,
    -- The group the AI had given.
    ai_bucket       text        not null,
    agrees          boolean     not null,
    -- The group the person expected; null when they agree, and never the AI's own.
    expected_bucket text,
    -- The places of the requirements the person says the AI judged wrongly.
    requirements    integer[]   not null default '{}',
    note            text,
    created_at      timestamptz not null default now(),
    constraint matching_feedback_ai_bucket check (ai_bucket in ('direct', 'industry', 'technology', 'none')),
    constraint matching_feedback_expected check (
        (agrees and expected_bucket is null)
        or (not agrees and expected_bucket in ('direct', 'industry', 'technology', 'none')
            and expected_bucket <> ai_bucket)),
    constraint matching_feedback_note check (note is null or char_length(note) between 1 and 500)
);

create index matching_feedback_candidate_idx on matching_feedback (candidate_id, account_id, created_at desc);
create index matching_feedback_created_idx on matching_feedback (created_at);
