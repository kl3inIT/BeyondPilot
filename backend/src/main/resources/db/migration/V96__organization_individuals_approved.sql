-- A builder on their own stands for its one person (BEY-189): nothing about it waits for GenAI Fund, and it has no
-- domain, invitations or requests to join. Refused and taken-down ones keep the operator's decision.
update organization
set status           = 'approved',
    decision_reason  = null,
    decision_message = null,
    decided_at       = now()
where type = 'independent_builder'
  and status in ('in_review', 'needs_changes');

update organization
set email_domain = null,
    auto_join    = false
where type = 'independent_builder';

update organization_invitation
set status     = 'revoked',
    decided_at = now()
where status = 'pending'
  and organization_id in (select id from organization where type = 'independent_builder');

update organization_join_request
set status     = 'declined',
    decided_at = now()
where status = 'pending'
  and not claim
  and organization_id in (select id from organization where type = 'independent_builder');
