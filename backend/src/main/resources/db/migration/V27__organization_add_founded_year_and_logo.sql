-- The year an organization (or an independent builder's practice) started, and the address of its logo. Both are
-- asked when an organization is created and saved; those made before have neither until an owner fills them in.
alter table organization
    add column founded_year integer check (founded_year between 1800 and 2100),
    add column logo_url     text;
