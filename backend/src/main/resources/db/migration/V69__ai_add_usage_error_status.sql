-- The HTTP status a provider answered a failed call with (BEY-104), so that a request refused for its size can be
-- told from a refused key or a provider that is down. Null for a call that answered, for a failure without a status,
-- such as a timeout, and for every row written before.
alter table ai_usage
    add column error_status integer;
