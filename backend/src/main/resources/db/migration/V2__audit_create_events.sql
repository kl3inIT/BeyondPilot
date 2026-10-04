-- The record of sensitive changes: who did what to what, and when. Written once; nothing updates or deletes a row.
create table audit_event (
    id             uuid primary key,
    occurred_at    timestamptz not null default now(),
    -- '<subject>.<verb>' from the catalog in AuditAction; a value never changes meaning.
    action         text        not null,
    -- Null when the server configuration acted. Deliberately not a foreign key: an event that is never deleted must
    -- not keep an account from being deleted, and the label and address keep the event readable.
    actor_id       uuid,
    -- Who the actor was at that moment; a later rename must not rewrite the record.
    actor_label    text,
    actor_email    text,
    resource_type  text        not null,
    resource_id    text        not null,
    resource_label text        not null,
    -- The fields the action declares, and no other.
    details        jsonb       not null default '{}'::jsonb,
    -- The request that made the change, as logged and returned in X-Request-Id.
    request_id     uuid,
    constraint audit_event_details_object check (jsonb_typeof(details) = 'object'),
    constraint audit_event_actor_named check ((actor_id is null) = (actor_label is null))
);

-- Read newest first; narrowed by what was acted on, or by who acted.
create index audit_event_time_idx on audit_event (occurred_at desc, id desc);
create index audit_event_resource_idx on audit_event (resource_type, resource_id, occurred_at desc);
create index audit_event_actor_idx on audit_event (actor_id, occurred_at desc);

create function audit_event_append_only() returns trigger language plpgsql as $$
begin
    raise exception 'Audit events are append-only';
end;
$$;

create trigger audit_event_append_only
    before update or delete on audit_event
    for each row execute function audit_event_append_only();
