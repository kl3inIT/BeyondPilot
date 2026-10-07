-- An operator merges a duplicate organization into the one to keep (BEY-63). The duplicate stays as a `merged` record
-- that says where it went, when and by whom; its members, invitations and requests move to the kept organization.
alter table organization
    drop constraint organization_status_check,
    add constraint organization_status_check check (status in ('in_review', 'needs_changes', 'approved', 'rejected',
                                                               'merged')),
    add column merged_into_id       uuid references organization (id),
    add column merged_at            timestamptz,
    add column merged_by_account_id uuid references identity_account (id),
    add constraint organization_merged_has_target check (
        (status = 'merged') = (merged_into_id is not null and merged_at is not null and merged_by_account_id is not null)),
    add constraint organization_not_merged_into_itself check (merged_into_id <> id);

-- A person moved by a merge sees once, in their workspace, which organization they came from.
alter table organization_member
    add column merged_from_id uuid references organization (id);
