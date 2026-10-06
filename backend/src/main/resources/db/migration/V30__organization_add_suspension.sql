-- An operator may take an approved organization down: it leaves the directories and cannot invite or write solutions,
-- while its members keep their workspace and read why. Restoring returns it to `approved`.
alter table organization
    drop constraint organization_status_check,
    add constraint organization_status_check check (status in ('pending', 'approved', 'rejected', 'suspended')),
    add column suspension_reason text check (suspension_reason in ('misleading_information', 'not_a_real_organization',
                                                                   'breaks_the_rules', 'other')),
    add column suspension_message text,
    add column suspended_at timestamptz;
