-- The organization that posted a use case decides on the proposals it received (BEY-133 follow-up): shortlisted or
-- declined, changeable at will, never undecided again. A decision tells nobody; the outcomes are sent once for the use
-- case, and `outcome` keeps the decision last communicated to the sender, so a later change is sent again and an
-- unchanged one is not. Taking a proposal back clears both; the history keeps every decision.
alter table use_case_proposal
    add column decision               text check (decision in ('shortlisted', 'declined')),
    add column decided_at             timestamptz,
    add column decided_by_account_id  uuid references identity_account (id),
    add column outcome                text check (outcome in ('shortlisted', 'declined')),
    add column outcome_sent_at        timestamptz,
    add constraint use_case_proposal_decision_complete check ((decision is null) = (decided_at is null)
        and (decision is null) = (decided_by_account_id is null)),
    add constraint use_case_proposal_outcome_complete check ((outcome is null) = (outcome_sent_at is null)),
    add constraint use_case_proposal_decision_is_sent check (decision is null or status = 'sent');

-- Every decision, who made it and when. Rows stay when a proposal is taken back.
create table use_case_proposal_decision (
    id                    uuid primary key,
    proposal_id           uuid        not null references use_case_proposal (id) on delete cascade,
    decision              text        not null check (decision in ('shortlisted', 'declined')),
    decided_by_account_id uuid        not null references identity_account (id),
    decided_at            timestamptz not null
);

create index use_case_proposal_decision_proposal_idx on use_case_proposal_decision (proposal_id, decided_at);
