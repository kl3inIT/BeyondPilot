-- The meaning of each item, for search by what a query means and not only by its words. The vector sits on the item's
-- row: one vector per item, made from its card by one model at a time (docs/research/2026-10-06-search-references.md,
-- "Where the embedding lives"). A row needs a vector when embedded_hash differs from content_hash or its model is not
-- the one configured; nothing else marks it.
create extension if not exists vector;

alter table search_document
    -- Null until the job embeds the item; the item is found by its words meanwhile.
    add column embedding                 vector(1536),
    -- The model that made the vector; a vector of another model is never compared with a query.
    add column embedding_model           text,
    -- The content_hash the vector was made from.
    add column embedded_hash             text,
    -- An item the provider refused on its own waits longer each time; a provider that is down pauses the job instead.
    add column embedding_attempts        integer not null default 0,
    add column embedding_next_attempt_at timestamptz,
    add column embedding_error           text;

create index search_document_embedding_idx on search_document using hnsw (embedding vector_cosine_ops);
