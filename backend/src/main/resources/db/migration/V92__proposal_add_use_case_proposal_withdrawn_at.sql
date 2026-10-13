-- A provider may take back a proposal it sent to a use case (BEY-133 follow-up). The proposal goes back to a draft, which
-- keeps what the form held, and notes when it was taken back so its owner reads that it was, not that it never was sent.
-- It is cleared when the proposal is sent again.
alter table use_case_proposal
    add column withdrawn_at timestamptz,
    add constraint use_case_proposal_withdrawn_is_draft check (withdrawn_at is null or status = 'draft');
