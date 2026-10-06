-- One review lifecycle for everything GenAI Fund reviews (BEY-76). A profile is a `draft`, waits `in_review`, is sent
-- back (`needs_changes`) with a reason its person reads, or is `approved`. Taking an approved profile away from the
-- public is no longer a status: `suspended_at` says it is down while its review stays `approved`, and restoring clears
-- it. As before, the person can correct a profile taken down and send it again; approving it lifts the takedown.
alter table talent_profile
    add column suspension_reason text check (suspension_reason in ('incomplete', 'unverifiable', 'inappropriate',
                                                                   'other')),
    add column suspension_message text,
    add column suspended_at timestamptz;

alter table talent_profile drop constraint talent_profile_status_check;

-- A removal was the decision on the profile; it becomes the takedown, and the review stays approved.
update talent_profile
set status = 'approved', suspension_reason = decision_reason, suspension_message = decision_message,
    suspended_at = coalesce(decided_at, updated_at), decision_reason = null, decision_message = null
where status = 'removed';
update talent_profile set status = 'in_review' where status = 'submitted';
update talent_profile set status = 'needs_changes' where status = 'changes_requested';

alter table talent_profile
    add constraint talent_profile_status_check check (status in ('draft', 'in_review', 'needs_changes', 'approved'));

-- The public directory reads approved, listed profiles that are not taken down.
drop index talent_profile_public_idx;
create index talent_profile_public_idx on talent_profile (name)
    where status = 'approved' and listed and suspended_at is null;
