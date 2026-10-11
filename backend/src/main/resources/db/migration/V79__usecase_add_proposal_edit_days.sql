-- How long after a proposal is sent its organization may still edit it (BEY-133). GenAI Fund sets it for each use case;
-- 0 means a sent proposal cannot be edited.
alter table use_case
    add column proposal_edit_days integer not null default 7 check (proposal_edit_days between 0 and 90);
