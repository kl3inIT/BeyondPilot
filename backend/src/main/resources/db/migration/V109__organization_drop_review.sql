-- GenAI Fund no longer reviews organizations (BEY-236, Kai's words of 21 October 2026): an organization is active when
-- it is created, and an operator only takes it down, restores it, merges it or decides an ownership claim on it.

-- Owners of the organizations that wait today are told once, after commit, that theirs is active. This migration only
-- marks them; it sends nothing.
alter table organization
    add column activation_notice_pending boolean not null default false;

-- A review still open ends: the organization is active, and what its reviewers said stays in the decision columns.
update organization
set status                    = 'approved',
    activation_notice_pending = true
where status in ('in_review', 'needs_changes');

-- A refusal becomes a take-down: the organization stays out of the directories, and its owners read why.
update organization
set status             = 'approved',
    suspended_at       = coalesce(decided_at, updated_at),
    suspension_message = decision_message,
    suspension_reason  = case decision_reason when 'not_a_real_organization' then 'not_a_real_organization' else 'other' end
where status = 'rejected';

alter table organization
    drop constraint organization_status_check,
    alter column status set default 'approved',
    add constraint organization_status_check check (status in ('approved', 'merged'));

-- Nothing approves, refuses or sends back an organization any more.
delete from email_template where kind in ('organization_approved', 'organization_refused', 'organization_sent_back');
