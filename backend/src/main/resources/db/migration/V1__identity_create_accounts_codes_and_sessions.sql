create table identity_account (
    id            uuid primary key,
    email         text        not null,
    display_name  text,
    status        text        not null default 'active' check (status in ('active', 'disabled')),
    platform_role text        not null default 'user' check (platform_role in ('user', 'operator')),
    last_login_at timestamptz,
    version       bigint      not null default 0,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

-- One account per address whatever its letter case; the address itself is kept as the person wrote it.
create unique index identity_account_email_key on identity_account (lower(email));

create table identity_external_identity (
    id         uuid primary key,
    account_id uuid        not null references identity_account (id) on delete cascade,
    provider   text        not null check (provider in ('google')),
    subject    text        not null,
    created_at timestamptz not null default now(),
    constraint identity_external_identity_provider_subject_key unique (provider, subject)
);

create index identity_external_identity_account_id_idx on identity_external_identity (account_id);

-- One emailed sign-in code. The id stays in the session of the browser that asked; the code is stored as a hash.
create table identity_sign_in_challenge (
    id              uuid primary key,
    email           text        not null,
    code_hash       text        not null,
    failed_attempts integer     not null default 0,
    expires_at      timestamptz not null,
    created_at      timestamptz not null default now()
);

create index identity_sign_in_challenge_email_idx on identity_sign_in_challenge (lower(email));

-- The tables of Spring Session (spring-session-jdbc, schema-postgresql.sql).
create table spring_session (
    primary_id            char(36) not null,
    session_id            char(36) not null,
    creation_time         bigint   not null,
    last_access_time      bigint   not null,
    max_inactive_interval int      not null,
    expiry_time           bigint   not null,
    principal_name        varchar(100),
    constraint spring_session_pk primary key (primary_id)
);

create unique index spring_session_ix1 on spring_session (session_id);
create index spring_session_ix2 on spring_session (expiry_time);
create index spring_session_ix3 on spring_session (principal_name);

create table spring_session_attributes (
    session_primary_id char(36)     not null,
    attribute_name     varchar(200) not null,
    attribute_bytes    bytea        not null,
    constraint spring_session_attributes_pk primary key (session_primary_id, attribute_name),
    constraint spring_session_attributes_fk foreign key (session_primary_id) references spring_session (primary_id) on delete cascade
);
