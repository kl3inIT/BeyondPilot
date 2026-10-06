-- Reviewing the applications of a program (BEY-38): its judging criteria, the judges it invites, their assessments,
-- GenAI Fund's decisions and the release of the outcomes.

-- GenAI Fund's decision on a submitted application. It stays internal until the program's outcomes are released.
alter table proposal
    add column review_status text not null default 'under_review'
        check (review_status in ('under_review', 'shortlisted', 'not_selected'));

-- What a program's applications are judged on, in order. Fixed once the first assessment of the program is saved.
create table review_criterion (
    id          uuid primary key,
    program_id  uuid    not null references program (id) on delete cascade,
    position    integer not null,
    name        text    not null,
    description text,
    constraint review_criterion_program_position_key unique (program_id, position)
);

-- A judge invited to a program by address. The person who signs in with that address reviews the program; no link
-- carries a secret. Operators review every program without an invitation.
create table proposal_reviewer (
    id                    uuid primary key,
    program_id            uuid        not null references program (id) on delete cascade,
    email                 text        not null,
    -- The account behind the address, set when they first open the review.
    account_id            uuid references identity_account (id),
    invited_by_account_id uuid        not null references identity_account (id),
    invited_at            timestamptz not null,
    -- An invitation nobody used by then lapses; sending it again renews it.
    expires_at            timestamptz not null,
    joined_at             timestamptz,
    removed_at            timestamptz
);

-- An address is invited once to a program while it is not removed.
create unique index proposal_reviewer_program_email_key on proposal_reviewer (program_id, lower(email))
    where removed_at is null;

create index proposal_reviewer_email_idx on proposal_reviewer (lower(email)) where removed_at is null;

-- One person's assessment of an application: a score for each criterion, by criterion identifier, and a private note,
-- on the version they read. A conflict of interest leaves the scores out.
create table proposal_assessment (
    proposal_id    uuid        not null references proposal (id) on delete cascade,
    account_id     uuid        not null references identity_account (id),
    version_number integer     not null,
    scores         jsonb       not null default '{}'::jsonb,
    note           text,
    conflict       boolean     not null default false,
    saved_at       timestamptz not null,
    primary key (proposal_id, account_id),
    constraint proposal_assessment_scores_object check (jsonb_typeof(scores) = 'object')
);

-- Every change of a decision, with who made it and their private reason. Append-only.
create table proposal_review_decision (
    id          uuid primary key,
    proposal_id uuid        not null references proposal (id) on delete cascade,
    account_id  uuid        not null references identity_account (id),
    from_status text        not null,
    to_status   text        not null,
    reason      text,
    decided_at  timestamptz not null
);

create index proposal_review_decision_proposal_idx on proposal_review_decision (proposal_id, decided_at);

-- The release of a program's outcomes, once, with the email each group was sent.
create table proposal_release (
    program_id             uuid primary key references program (id),
    released_at            timestamptz not null,
    released_by_account_id uuid        not null references identity_account (id),
    shortlisted_subject    text        not null,
    shortlisted_message    text        not null,
    not_selected_subject   text        not null,
    not_selected_message   text        not null
);
