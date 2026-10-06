-- How email leaves the application. One row, written by operators; nothing is configured from the environment.
-- Secrets are AES-GCM ciphertexts made with BEYONDPILOT_NOTIFICATION_ENCRYPTION_KEY and are never read back out.
create table email_settings (
    id                     smallint    primary key default 1,
    -- Null until an operator chooses one: email then waits in the queue.
    provider               text,
    from_name              text,
    from_address           text,
    reply_to               text,
    smtp_host              text,
    smtp_port              integer,
    smtp_username          text,
    smtp_password          bytea,
    smtp_security          text        not null default 'starttls',
    ses_region             text,
    ses_access_key_id      text,
    ses_secret_access_key  bytea,
    ses_configuration_set  text,
    resend_api_key         bytea,
    -- The appearance every email is wrapped in; null keeps the default.
    accent_color           text,
    footer                 text,
    version                bigint      not null default 0,
    updated_by             uuid,
    updated_by_label       text,
    updated_at             timestamptz not null default now(),
    constraint email_settings_one_row check (id = 1),
    constraint email_settings_provider check (provider in ('ses', 'resend', 'smtp')),
    constraint email_settings_smtp_security check (smtp_security in ('starttls', 'tls', 'none')),
    constraint email_settings_smtp_port check (smtp_port between 1 and 65535),
    constraint email_settings_accent_color check (accent_color ~ '^#[0-9A-Fa-f]{6}$')
);

insert into email_settings (id) values (1);

-- An operator's wording of one kind of email. Without a row the default in code is used, so resetting a template
-- deletes its row. Email is written in English.
create table email_template (
    kind             text        primary key,
    subject          text        not null,
    body             text        not null,
    updated_by       uuid        not null,
    updated_by_label text        not null,
    updated_at       timestamptz not null default now(),
    version          bigint      not null default 0
);

-- Every email, as it was rendered when it was queued: the queue the sender works through and the log operators read.
create table email_message (
    id                  uuid        primary key,
    kind                text        not null,
    recipient           text        not null,
    subject             text        not null,
    html                text        not null,
    text                text        not null,
    status              text        not null,
    attempts            integer     not null default 0,
    -- When the sender may take the message next; a claim moves it forward so no two senders take it at once.
    next_attempt_at     timestamptz not null default now(),
    provider            text,
    provider_message_id text,
    -- The typed reason of the last failure, never a provider's text.
    last_error          text,
    created_at          timestamptz not null default now(),
    sent_at             timestamptz,
    updated_at          timestamptz not null default now(),
    constraint email_message_status check
        (status in ('queued', 'sent', 'delivered', 'bounced', 'complained', 'failed', 'skipped')),
    constraint email_message_provider check (provider in ('ses', 'resend', 'smtp'))
);

create index email_message_time_idx on email_message (created_at desc, id desc);
create index email_message_due_idx on email_message (next_attempt_at) where status = 'queued';
create index email_message_recipient_idx on email_message (lower(recipient), created_at desc);
create unique index email_message_provider_message_idx on email_message (provider, provider_message_id);

-- What happened to a message after it was handed over: the provider's reports.
create table email_event (
    id          uuid        primary key,
    message_id  uuid        not null references email_message (id) on delete cascade,
    type        text        not null,
    occurred_at timestamptz not null,
    -- A typed summary such as an SMTP status code; never a provider's free text.
    detail      text,
    constraint email_event_type check (type in ('delivered', 'bounced', 'soft_bounced', 'complained'))
);

create index email_event_message_idx on email_event (message_id, occurred_at);

-- Addresses that are never sent to again, kept lowercased.
create table email_suppression (
    address          text        primary key,
    reason           text        not null,
    message_id       uuid        references email_message (id) on delete set null,
    created_by       uuid,
    created_by_label text,
    created_at       timestamptz not null default now(),
    constraint email_suppression_reason check (reason in ('bounce', 'complaint', 'manual')),
    constraint email_suppression_lowercase check (address = lower(address))
);
