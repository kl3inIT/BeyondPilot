-- An email domain is now verified by an operator, at review or on the record; it is no longer taken from the address
-- of the person who created the organization. None of the domains held so far was verified in that sense, so they
-- are cleared, and joining at once, which needs a verified domain, is off until an owner turns it on.
update organization
set email_domain = null,
    auto_join    = false;

alter table organization
    alter column auto_join set default false;

-- Whether GenAI Fund decides the request, because nobody owned the organization when it was made. It was derived
-- when read, so a request could change kind after it was sent.
alter table organization_join_request
    add column claim boolean not null default false;

update organization_join_request r
set claim = true
where r.status = 'pending'
  and not exists (select 1
                  from organization_member m
                  where m.organization_id = r.organization_id
                    and m.role = 'owner');

-- An operator's invitation stays out of the limits on what an organization's owners send.
alter table organization_invitation
    add column sent_by_operator boolean not null default false;

-- The invitations an organization sent in the last day are counted on every invitation.
create index organization_invitation_sent_idx on organization_invitation (organization_id, created_at);
