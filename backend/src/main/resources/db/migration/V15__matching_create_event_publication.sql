-- The Spring Modulith event publication registry: a publication for each module listener that has an event to handle,
-- written in the publisher's transaction and deleted once the listener completes, so one still here after a restart
-- is delivered again. The shape is Spring Modulith 2's schema for PostgreSQL
-- (spring-modulith-events-jdbc, schemas/v2/schema-postgresql.sql); Spring Modulith reads and writes the table.
create table event_publication (
    id                     uuid                     not null,
    listener_id            text                     not null,
    event_type             text                     not null,
    serialized_event       text                     not null,
    publication_date       timestamp with time zone not null,
    completion_date        timestamp with time zone,
    status                 text,
    completion_attempts    int,
    last_resubmission_date timestamp with time zone,
    constraint event_publication_pk primary key (id)
);

create index event_publication_serialized_event_hash_idx on event_publication using hash (serialized_event);
create index event_publication_by_completion_date_idx on event_publication (completion_date);
