-- The name a sender gives with their message, so the person they write to always reads who wrote, even when the
-- account has no name of its own. The enquiries sent before have none and read the account's name.
alter table talent_enquiry add column sender_name text;
