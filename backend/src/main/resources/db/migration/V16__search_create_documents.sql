-- The search index: one row per program, solution or talent profile that search may return, built by the search module
-- from what the owning module publishes. The owners stay the source of truth; a row can always be rebuilt from them.
create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- unaccent() is only STABLE, because its dictionary could change, so a generated column or an index cannot call it.
-- Naming the dictionary makes the result fixed, which lets this wrapper be IMMUTABLE. "Việt Nam" becomes "Viet Nam" and
-- "Đổi mới" becomes "Doi moi", so a visitor finds Vietnamese text with or without its marks.
create function search_unaccent(text) returns text
    language sql immutable strict parallel safe
    return public.unaccent('public.unaccent'::regdictionary, $1);

create table search_document (
    -- 'program', 'solution' or 'talent'; 'use_case' joins with its module.
    kind           text        not null,
    item_id        uuid        not null,
    slug           text        not null,
    title          text        not null,
    -- The organization, partner or headline shown under the title.
    subtitle       text,
    summary        text        not null,
    -- Industries, focus areas, roles, skills and type, as words.
    keywords       text        not null,
    -- The canonical text of the item: what a person reads on its page, in one block.
    card           text        not null,
    -- What a result card shows besides its text, such as industries or a country.
    facets         jsonb       not null default '{}'::jsonb,
    -- False for an approved solution its owner has unlisted: matching may use it, a visitor never sees it.
    listed         boolean     not null,
    -- A program's dates, for its phase on the result card.
    starts_on      date,
    ends_on        date,
    indexed_at     timestamptz not null default now(),
    -- Changes when anything a person can search or read changes, which tells an embedding to be computed again.
    content_hash   text        generated always as (md5(
        title || chr(31) || coalesce(subtitle, '') || chr(31) || summary || chr(31) || keywords || chr(31) || card
    )) stored,
    search_vector  tsvector    generated always as (
        setweight(to_tsvector('simple', search_unaccent(title)), 'A')
        || setweight(to_tsvector('simple', search_unaccent(coalesce(subtitle, ''))), 'B')
        || setweight(to_tsvector('simple', search_unaccent(keywords)), 'C')
        || setweight(to_tsvector('simple', search_unaccent(card)), 'D')
    ) stored,
    constraint search_document_pk primary key (kind, item_id),
    constraint search_document_kind check (kind in ('program', 'solution', 'talent')),
    constraint search_document_facets_object check (jsonb_typeof(facets) = 'object')
);

create index search_document_vector_idx on search_document using gin (search_vector);
-- Typos are matched by the trigram similarity of the query to each title, with a threshold lower than the operators'
-- default, so no trigram index serves it: a few thousand titles are compared in a scan.
create index search_document_kind_idx on search_document (kind, listed);
