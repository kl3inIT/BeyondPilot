-- The emails of a release as an operator is writing them, kept so that leaving the page does not lose them (BEY-121).
-- One row per program, until its outcomes are released. A subject or a message may be empty while it is written.
create table proposal_release_draft (
    program_id            uuid primary key references program (id),
    shortlisted_subject   text        not null,
    shortlisted_message   text        not null,
    not_selected_subject  text        not null,
    not_selected_message  text        not null,
    updated_by_account_id uuid        not null references identity_account (id),
    updated_at            timestamptz not null
);
