-- Chat providers, their models, the model each task uses and what every call took (BEY-92). The ai module owns these
-- tables and ai_provider, which V42 created under search.

-- A provider is connected for chat as well as for embeddings. A chat provider is reached through an adapter, the code
-- that speaks its API, at an address the operator gives; an embedding provider keeps its vendor, which fixes its
-- address and models. A provider can be switched off without losing its key.
alter table ai_provider
    drop constraint ai_provider_purpose,
    drop constraint ai_provider_vendor,
    alter column vendor drop not null,
    add column adapter_type text not null default 'openai',
    add column enabled boolean not null default true,
    add constraint ai_provider_purpose check (purpose in ('embedding', 'chat')),
    add constraint ai_provider_vendor check (
        (purpose = 'embedding' and vendor in ('openai', 'openrouter')) or (purpose = 'chat' and vendor is null));

-- A model of a chat provider that an operator enabled. Limits, capabilities and prices come from the provider's own
-- list, then from the bundled catalog, and an operator may correct them. A price is in US dollars per million tokens;
-- null means nobody published one.
create table ai_model (
    id                 uuid        primary key,
    provider_id        uuid        not null references ai_provider (id) on delete cascade,
    model_name         text        not null,
    display_name       text        not null,
    context_window     integer     not null,
    max_output_tokens  integer,
    tool_calling       boolean     not null,
    vision             boolean     not null,
    reasoning          boolean     not null,
    input_price        numeric(12, 6),
    output_price       numeric(12, 6),
    cached_input_price numeric(12, 6),
    version            bigint      not null default 0,
    updated_by         uuid        not null,
    updated_by_label   text        not null,
    updated_at         timestamptz not null default now(),
    constraint ai_model_name unique (provider_id, model_name),
    constraint ai_model_context check (context_window > 0),
    constraint ai_model_output check (max_output_tokens is null or max_output_tokens > 0)
);

-- The model a task uses and how hard it reasons. One row per task the code names; a task without a model does not
-- run. Removing the model leaves the task unset.
create table ai_task_model (
    task             text        primary key,
    model_id         uuid        references ai_model (id) on delete set null,
    reasoning_effort text,
    version          bigint      not null default 0,
    updated_by       uuid,
    updated_by_label text,
    updated_at       timestamptz not null default now(),
    constraint ai_task_model_task check (task in ('matching')),
    constraint ai_task_model_effort check (reasoning_effort is null or reasoning_effort in ('off', 'low', 'medium', 'high'))
);

insert into ai_task_model (task) values ('matching');

-- One row per call to a chat model: what it took and what the model cost then. No prompt and no answer. The provider
-- and the model are kept by name, with no foreign key, so removing either keeps the record.
create table ai_usage (
    id                 uuid        primary key,
    occurred_at        timestamptz not null,
    task               text        not null,
    provider_id        uuid        not null,
    provider_name      text        not null,
    model_name         text        not null,
    input_tokens       bigint,
    output_tokens      bigint,
    cache_read_tokens  bigint,
    cache_write_tokens bigint,
    duration_ms        bigint      not null,
    outcome            text        not null,
    error_type         text,
    -- What the call was about, as the caller names it: a use case, an application.
    subject_type       text,
    subject_id         text,
    input_price        numeric(12, 6),
    output_price       numeric(12, 6),
    cached_input_price numeric(12, 6),
    constraint ai_usage_outcome check (outcome in ('ok', 'failed'))
);

create index ai_usage_occurred_idx on ai_usage (occurred_at desc);
create index ai_usage_task_idx on ai_usage (task, occurred_at desc);
