-- What an operator's call read (BEY-222): the record's kind, id, its name when it was read and its admin page, so
-- Admin › AI › MCP › Activity shows and links it. Never what was asked or answered; a search reads no one record.
alter table mcp_call
    add column target_kind  text,
    add column target_id    text,
    add column target_label varchar(300),
    add column target_path  varchar(500),
    add constraint mcp_call_target_whole check (
        (target_kind is null and target_id is null and target_label is null and target_path is null)
        or (target_kind is not null and target_id is not null and target_label is not null));
