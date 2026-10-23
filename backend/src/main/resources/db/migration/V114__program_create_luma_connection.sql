-- The Luma calendar BeyondPilot reads through Luma's API (BEY-245): the key an operator gave, sealed, the calendar it
-- belongs to, and the webhook BeyondPilot made on it with its signing secret, sealed. One row at most: one calendar.
create table program_luma_connection (
    id                 smallint primary key default 1 check (id = 1),
    -- AES-256-GCM under BEYONDPILOT_PROGRAM_ENCRYPTION_KEY; never returned.
    api_key            bytea       not null,
    -- The last characters of the key, so an operator can tell which key is in use.
    api_key_ending     text        not null check (char_length(api_key_ending) <= 8),
    calendar_id        text        not null,
    calendar_name      text        not null,
    -- Null while no webhook could be made; the hourly read goes on without it.
    webhook_id         text,
    webhook_secret     bytea,
    webhook_error      text,
    last_read_at       timestamptz,
    last_read_error    text,
    connected_by_account_id uuid references identity_account (id),
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now(),
    version            bigint      not null default 0
);
