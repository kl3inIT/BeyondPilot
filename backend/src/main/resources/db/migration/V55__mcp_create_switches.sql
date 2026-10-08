-- What operators set in Admin › AI › MCP for mcp (BEY-78): a switch per server and per tool, named server or server.tool ('user', 'user.search', 'operator.fetch'). A
-- name without a row is on; only the user server and the tools have switches.
create table mcp_switch (
    name       text        primary key check (name ~ '^(user|operator)(\.[a-z_]+)?$'),
    enabled    boolean     not null,
    changed_at timestamptz not null default now()
);
