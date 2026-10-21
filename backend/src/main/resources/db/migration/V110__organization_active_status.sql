-- The client decided (BEY-236, 21 October 2026): an organization's status is `active`, not `approved`, nobody refuses an
-- organization, and no email tells an owner theirs is active. Neither V109 nor this migration has run on any deployed
-- database, so each fix is made here rather than by retiring anything.

-- V109 turned every refused organization into a take-down. Nobody refuses an organization any more, so those become
-- active again. They are told apart from a real take-down by what V109 wrote and an operator never writes together:
--  * decision_reason is not null: refusing sets it and approving clears it (Organization.approve), so an organization
--    that was ever approved, and so can be taken down, has none; V44 and V96 also null it where a status moved.
--  * suspended_at = decided_at: V109 copied the date of the refusal into it, and an operator's take-down stamps the
--    time of the take-down, which is later than the decision. decided_at is never null on a refusal, so the
--    `coalesce(decided_at, updated_at)` branch of V109 cannot apply to a refused row.
--  * suspension_message is not distinct from decision_message: V109 copied the operator's note across.
-- A real take-down fails the first criterion, so it stays down.
update organization
set suspended_at       = null,
    suspension_reason  = null,
    suspension_message = null
where status = 'approved'
  and decision_reason is not null
  and suspended_at = decided_at
  and suspension_message is not distinct from decision_message;

alter table organization
    drop constraint organization_status_check;

update organization
set status = 'active'
where status = 'approved';

alter table organization
    alter column status set default 'active',
    add constraint organization_status_check check (status in ('active', 'merged'));

-- Nobody tells an owner that an organization is active.
alter table organization
    drop column activation_notice_pending;

delete from email_template where kind = 'organization_activated';
