-- A proposal no longer attaches the sender's talent profile (BEY-133): the brief asks for the submitting identity, which
-- is the account's name, address, country and number. A proposal sent before keeps the copy it carries; a new one
-- carries none, so the flag that said whether it attached one goes.
alter table use_case_proposal
    drop constraint use_case_proposal_snapshot_is_attached;

alter table use_case_proposal
    drop column attach_profile;
