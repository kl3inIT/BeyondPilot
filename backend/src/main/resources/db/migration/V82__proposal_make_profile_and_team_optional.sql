-- A proposal no longer needs the sender's talent profile (BEY-133): the sender attaches it, or sends without it. The
-- copy kept at sending exists only for a proposal that attached the profile.
alter table use_case_proposal
    add column attach_profile boolean not null default false;

update use_case_proposal
set attach_profile = true
where talent is not null;

alter table use_case_proposal
    drop constraint use_case_proposal_sent_has_snapshot;

alter table use_case_proposal
    add constraint use_case_proposal_sent_has_time check ((status = 'sent') = (sent_at is not null)),
    add constraint use_case_proposal_snapshot_is_attached check (talent is null or attach_profile);
