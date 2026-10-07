-- One review lifecycle for everything GenAI Fund reviews (BEY-76). An organization waits `in_review`, is sent back
-- (`needs_changes`) with a message its owners read, is `approved` or is `rejected` for good. Taking an approved
-- organization down is no longer a status: `suspended_at` says it is down while its review stays `approved`, and
-- restoring clears it.

-- An organization restored before kept the date it was taken down; it is not down now. Why it was taken down stays
-- readable, as a restore keeps it.
update organization set suspended_at = null where status = 'approved';

alter table organization drop constraint organization_status_check;
alter table organization drop constraint organization_decision_reason_check;

-- A refusal for missing information was a send back: the owners corrected it and sent it again.
update organization set status = 'needs_changes', decision_reason = null
where status = 'rejected' and decision_reason = 'incomplete';
update organization set status = 'in_review' where status = 'pending';
update organization set status = 'approved' where status = 'suspended';

alter table organization
    alter column status set default 'in_review',
    add constraint organization_status_check check (status in ('in_review', 'needs_changes', 'approved', 'rejected')),
    add constraint organization_decision_reason_check check (decision_reason in ('duplicate', 'not_a_real_organization',
                                                                                 'out_of_scope', 'other'));
