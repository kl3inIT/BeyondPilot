-- What each person agreed to about their personal data (BEY-240): one row for each choice, never changed or deleted,
-- because the controller must be able to prove a consent (Decree 356/2025/ND-CP art. 6(2)). A person's current choice
-- for a purpose is their latest row for it.
create table identity_consent_record (
    id          uuid primary key,
    account_id  uuid        not null references identity_account (id),
    -- platform, partners, ai or updates (ConsentPurpose).
    purpose     text        not null check (purpose in ('platform', 'partners', 'ai', 'updates')),
    granted     boolean     not null,
    -- The version of the consent text shown; its words are backend/src/main/resources/consent/v<version>.<locale>.md.
    version     integer     not null check (version > 0),
    locale      text        not null,
    -- How the choice was made: accept_all, choose, settings, undo or application.
    source      text        not null,
    -- The request that made the choice, as logged and returned in X-Request-Id.
    request_id  uuid,
    recorded_at timestamptz not null default now()
);

create index identity_consent_record_latest_idx on identity_consent_record (account_id, purpose, recorded_at desc);

create function identity_consent_record_append_only() returns trigger language plpgsql as $$
begin
    raise exception 'Consent records are append-only';
end;
$$;

create trigger identity_consent_record_append_only
    before update or delete on identity_consent_record
    for each row execute function identity_consent_record_append_only();
