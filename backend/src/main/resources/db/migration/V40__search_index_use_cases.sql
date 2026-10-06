-- Published use cases join the search index, as a fourth kind.
alter table search_document drop constraint search_document_kind;
alter table search_document
    add constraint search_document_kind check (kind in ('program', 'solution', 'talent', 'use_case'));
