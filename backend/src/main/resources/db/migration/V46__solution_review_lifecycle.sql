-- One review lifecycle for everything GenAI Fund reviews (BEY-76). A solution is a `draft`, waits `in_review`, is sent
-- back (`needs_changes`) with what its owners should change, is `approved`, or is `rejected` for good. Taking an
-- approved solution out of the directory is no longer a rejection: `suspended_at` says it is down while its review
-- stays `approved`, and restoring clears it.
--
-- A takedown names what went wrong after approval: the solution misleads, turns out not to be AI or cannot be
-- verified, or breaks the rules. `incomplete` is not among them; that is a send back before approval.
alter table solution
    add column suspension_reason text check (suspension_reason in ('misleading_information', 'not_an_ai_solution',
                                                                   'unverifiable', 'breaks_the_rules', 'other')),
    add column suspension_message text,
    add column suspended_at timestamptz;

alter table solution drop constraint solution_status_check;
alter table solution drop constraint solution_decision_reason_check;

-- Before this change a rejection was never final: its owners corrected the solution and sent it again. It also stood
-- for taking an approved solution out of the directory. So no stored rejection becomes the new final one. A solution
-- whose last decision before its last rejection was an approval was taken down (an approved solution could not be
-- sent again, so that rejection was not a review): it stays approved and the rejection becomes the takedown. Every
-- other rejection was a send back.
update solution s
set status = 'approved',
    suspended_at = s.decided_at,
    suspension_reason = case when s.decision_reason in ('unverifiable', 'not_an_ai_solution') then s.decision_reason
                             else 'other' end,
    suspension_message = s.decision_message,
    decision_reason = null,
    decision_message = null
where s.status = 'rejected'
  and (select d.action from audit_event d
       where d.resource_type = 'solution' and d.resource_id = s.id::text
         and d.action in ('solution.approve', 'solution.reject')
       order by d.occurred_at desc, d.id desc
       offset 1 limit 1) = 'solution.approve';
update solution set status = 'needs_changes', decision_reason = null where status = 'rejected';
update solution set status = 'in_review' where status = 'submitted';
-- Only a refusal carries a reason; a solution sent again kept the one it was sent back with.
update solution set decision_reason = null where status <> 'rejected';

alter table solution
    add constraint solution_status_check
        check (status in ('draft', 'in_review', 'needs_changes', 'approved', 'rejected')),
    add constraint solution_decision_reason_check
        check (decision_reason in ('not_an_ai_solution', 'duplicate', 'unverifiable', 'other'));

-- The public directory reads approved, listed solutions that are not taken down.
drop index solution_public_idx;
create index solution_public_idx on solution (name) where status = 'approved' and listed and suspended_at is null;

-- A customer deployment waits for review in the same words.
alter table solution_customer_deployment drop constraint solution_customer_deployment_status_check;
update solution_customer_deployment set status = 'in_review' where status = 'submitted';
alter table solution_customer_deployment
    alter column status set default 'in_review',
    add constraint solution_customer_deployment_status_check check (status in ('in_review', 'approved', 'rejected'));
