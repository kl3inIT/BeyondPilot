-- Every call AI apps make to BeyondPilot's MCP servers (BEY-78): who, through which app, which tool, how it ended and
-- how long it took. Arguments and results are never kept: they can hold what a person searched for or read. Rows older
-- than the retention (90 days) are deleted daily. mcp owns it.
create table mcp_call (
    id          uuid        primary key,
    called_at   timestamptz not null,
    account_id  uuid        not null,
    client_id   varchar(500) not null,
    server      text        not null check (server in ('user', 'operator')),
    tool        text        not null,
    outcome     text        not null check (outcome in ('ok', 'refused', 'failed')),
    duration_ms integer     not null check (duration_ms >= 0)
);

-- The activity, newest first, and its retention.
create index mcp_call_called_at on mcp_call (called_at desc);
-- A person's calls.
create index mcp_call_account on mcp_call (account_id, called_at desc);
