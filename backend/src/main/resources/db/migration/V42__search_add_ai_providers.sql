-- The AI providers operators connect in Admin › AI › Providers, one row each, and what search embeds with. Nothing is
-- configured from the environment. A key is an AES-GCM ciphertext made with BEYONDPILOT_AI_ENCRYPTION_KEY and is never
-- read back out. Search owns both tables until a second feature uses a provider; they then move to their own module.
create table ai_provider (
    id               uuid        primary key,
    -- What the provider is connected for; each purpose is a tab of the Providers screen.
    purpose          text        not null,
    vendor           text        not null,
    name             text        not null,
    base_url         text        not null,
    api_key          bytea,
    version          bigint      not null default 0,
    updated_by       uuid        not null,
    updated_by_label text        not null,
    updated_at       timestamptz not null default now(),
    constraint ai_provider_purpose check (purpose in ('embedding')),
    constraint ai_provider_vendor check (vendor in ('openai', 'openrouter')),
    constraint ai_provider_name unique (purpose, name)
);

-- How search uses embeddings. One row: the provider and model every item and query is embedded with, and whether
-- semantic search is on. A provider in use cannot be deleted.
create table search_settings (
    id               smallint    primary key default 1,
    semantic_enabled boolean     not null default true,
    provider_id      uuid        references ai_provider (id),
    model            text,
    -- When the model was chosen; every item is embedded again after a change.
    model_since      timestamptz,
    version          bigint      not null default 0,
    updated_by       uuid,
    updated_by_label text,
    updated_at       timestamptz not null default now(),
    constraint search_settings_one_row check (id = 1),
    constraint search_settings_model check ((provider_id is null) = (model is null))
);

insert into search_settings (id) values (1);
