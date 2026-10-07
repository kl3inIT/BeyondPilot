-- The authorization server AI apps sign in through (BEY-78): Spring Security's JDBC schema for registered clients and
-- authorizations, with PostgreSQL types (blob becomes text, timestamp becomes timestamptz) and wider
-- columns for clients identified by the URL of their metadata document. Spring writes these tables; identity owns them.
-- No consent is stored: every connection asks the person again.
create table oauth2_registered_client (
    id                            varchar(100)  not null primary key,
    client_id                     varchar(500)  not null unique,
    client_id_issued_at           timestamptz   not null default now(),
    client_secret                 varchar(200),
    client_secret_expires_at      timestamptz,
    client_name                   varchar(200)  not null,
    client_authentication_methods varchar(1000) not null,
    authorization_grant_types     varchar(1000) not null,
    redirect_uris                 text,
    post_logout_redirect_uris     text,
    scopes                        varchar(1000) not null,
    client_settings               text          not null,
    token_settings                text          not null
);

create table oauth2_authorization (
    id                            varchar(100)  not null primary key,
    registered_client_id          varchar(100)  not null,
    principal_name                varchar(200)  not null,
    authorization_grant_type      varchar(100)  not null,
    authorized_scopes             varchar(1000),
    attributes                    text,
    state                         varchar(500),
    authorization_code_value      text,
    authorization_code_issued_at  timestamptz,
    authorization_code_expires_at timestamptz,
    authorization_code_metadata   text,
    access_token_value            text,
    access_token_issued_at        timestamptz,
    access_token_expires_at       timestamptz,
    access_token_metadata         text,
    access_token_type             varchar(100),
    access_token_scopes           varchar(1000),
    oidc_id_token_value           text,
    oidc_id_token_issued_at       timestamptz,
    oidc_id_token_expires_at      timestamptz,
    oidc_id_token_metadata        text,
    refresh_token_value           text,
    refresh_token_issued_at       timestamptz,
    refresh_token_expires_at      timestamptz,
    refresh_token_metadata        text,
    user_code_value               text,
    user_code_issued_at           timestamptz,
    user_code_expires_at          timestamptz,
    user_code_metadata            text,
    device_code_value             text,
    device_code_issued_at         timestamptz,
    device_code_expires_at        timestamptz,
    device_code_metadata          text
);

-- Spring looks an authorization up by one of its values; a JWT is too long for a btree entry, so these are hashes.
create index oauth2_authorization_state on oauth2_authorization using hash (state);
create index oauth2_authorization_code on oauth2_authorization using hash (authorization_code_value);
create index oauth2_authorization_access_token on oauth2_authorization using hash (access_token_value);
create index oauth2_authorization_refresh_token on oauth2_authorization using hash (refresh_token_value);
-- A person's connected apps, and the cleanup of expired ones.
create index oauth2_authorization_principal on oauth2_authorization (principal_name, registered_client_id);
create index oauth2_authorization_refresh_expiry on oauth2_authorization (refresh_token_expires_at);
