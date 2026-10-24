-- Who of an organization may do what with one of its use cases, set per use case like sharing a file: the creator, the
-- organization's owners and GenAI Fund always may everything; `use_case_access` gives other members a role, and
-- `member_access` is what every other member of the organization may do. A use case written before this change keeps
-- what it had, every member doing everything, which is why the column defaults to `full_access`; the application
-- writes `none` for a use case a member starts now, so it is private to its creator until they share it.
alter table use_case
    add column member_access text not null default 'full_access'
        check (member_access in ('none', 'viewer', 'editor', 'full_access'));

create table use_case_access (
    use_case_id         uuid        not null references use_case (id) on delete cascade,
    account_id          uuid        not null references identity_account (id),
    role                text        not null check (role in ('viewer', 'editor', 'full_access')),
    added_by_account_id uuid        not null,
    created_at          timestamptz not null default now(),
    primary key (use_case_id, account_id)
);

create index use_case_access_account_idx on use_case_access (account_id);
