-- An invitation lapses when nobody answers it in time. One that is open today gets its full time from now, so
-- nobody loses an invitation to this change; an answered one keeps the date it would have had.
alter table organization_invitation
    add column expires_at timestamptz;

update organization_invitation
set expires_at = case when status = 'pending' then now() else created_at end + interval '7 days';

alter table organization_invitation
    alter column expires_at set not null,
    drop constraint organization_invitation_status_check,
    add constraint organization_invitation_status_check
        check (status in ('pending', 'accepted', 'declined', 'revoked', 'expired'));
