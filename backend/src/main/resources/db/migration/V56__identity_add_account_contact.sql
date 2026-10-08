-- Where a person is and the number to reach them on, kept on the account (BEY-87, brief 7.1) so that an application
-- starts from them instead of asking again. Both stay empty until the person gives them.
alter table identity_account
    add column country text check (country ~ '^[A-Z]{2}$'),
    add column phone   text check (length(phone) between 1 and 40);
