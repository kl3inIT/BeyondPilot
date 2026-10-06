-- An enquiry waits for the person behind the profile to answer it. Only an acceptance shares the two addresses; a
-- decline, a report and the close of an enquiry nobody answered share none. A report reads as a decline to the sender.
alter table talent_enquiry
    add column topic                  text not null default 'project' check (topic in ('project', 'role', 'other')),
    -- The organization the sender belonged to when they wrote, so the person reads what was true then.
    add column sender_organization_id uuid references organization (id),
    add column status                 text not null default 'pending' check (status in ('pending', 'accepted',
                                                                                         'declined', 'reported',
                                                                                         'closed')),
    add column answered_at            timestamptz,
    -- When the person was reminded of an enquiry that waits; a reminder is sent once.
    add column reminded_at            timestamptz;

-- The enquiries sent before this change were emailed with the sender's address, as an acceptance now is.
update talent_enquiry set status = 'accepted', answered_at = created_at;

alter table talent_enquiry alter column topic drop default;

-- A sender has at most one waiting enquiry to a profile.
create unique index talent_enquiry_pending_key on talent_enquiry (sender_account_id, profile_id)
    where status = 'pending';
-- The clock finds the enquiries that wait, the oldest first.
create index talent_enquiry_waiting_idx on talent_enquiry (created_at) where status = 'pending';
