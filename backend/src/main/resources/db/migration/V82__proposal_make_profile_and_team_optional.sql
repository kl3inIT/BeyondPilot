-- A proposal no longer needs the sender's talent profile (BEY-133): the brief asks for the submitting identity, which is
-- the account's name, address, country and number, and the profile is never a prerequisite. A proposal sent before
-- keeps the copy it carries; a new one carries none.
alter table use_case_proposal
    drop constraint use_case_proposal_sent_has_snapshot;

alter table use_case_proposal
    add constraint use_case_proposal_sent_has_time check ((status = 'sent') = (sent_at is not null));
