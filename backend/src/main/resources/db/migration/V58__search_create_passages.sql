-- What a solution's own material says, cut into passages short enough to search and to embed: a slide of its deck, a
-- part of a page of its website, one of its customer cases (docs/increments/active/bey-39-matching/design.md).
-- Matching finds candidates in them and gives them to the model that judges; the public search never reads this
-- table. A solution has many passages, so they are rows of their own and not columns of its row in search_document
-- (docs/research/2026-10-06-search-references.md, "The layout follows the cardinality").
create table search_passage (
    solution_id               uuid        not null,
    -- deck, website or customer_case.
    source                    text        not null,
    -- The page of the deck, the place of the web page among the site's pages, or the place of the customer case.
    page                      integer     not null,
    -- The place of the passage on its page, from 0. A slide and a customer case are one passage.
    part                      integer     not null default 0,
    -- The address of the web page; null for the other sources.
    locator                   text,
    -- What the passage is of, put before its text when it is embedded: "Zetamotion, deck page 3".
    heading                   text        not null,
    -- Empty for a page nothing has read.
    text                      text        not null,
    -- text: the file's own text, or text that was loaded. model: read by a model from the picture of the page.
    -- unread: a page without text, waiting for a model or read by none.
    reading                   text        not null,
    -- What the passages of this source were made from: the deck's file, a load, the solution's cases as they were.
    -- A source's passages are replaced together when it changes.
    origin                    text        not null,
    indexed_at                timestamptz not null default now(),
    content_hash              text        generated always as (md5(heading || chr(10) || text)) stored,
    search_vector             tsvector    generated always as (to_tsvector('simple', search_unaccent(text))) stored,
    -- The same columns as search_document: one vector per passage, by one model at a time, and an item the provider
    -- refuses on its own waits longer each time.
    embedding                 vector(1536),
    embedding_model           text,
    embedded_hash             text,
    embedding_attempts        integer     not null default 0,
    embedding_next_attempt_at timestamptz,
    embedding_error           text,
    primary key (solution_id, source, page, part),
    constraint search_passage_source check (source in ('deck', 'website', 'customer_case')),
    constraint search_passage_reading check (reading in ('text', 'model', 'unread'))
);

create index search_passage_vector_idx on search_passage using gin (search_vector);

create index search_passage_embedding_idx on search_passage using hnsw (embedding vector_cosine_ops);
