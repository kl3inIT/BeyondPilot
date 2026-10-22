-- An item whose person declined AI processing of their data (BEY-240) stays in the index for keyword search, but its
-- text is not sent to the embedding provider and it has no vector, so meaning search does not find it.
alter table search_document
    add column embeddable boolean not null default true;
