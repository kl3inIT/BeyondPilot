-- What operators set in Admin › AI › MCP for identity (BEY-78): the hosts whose apps BeyondPilot has reviewed, so their consent page carries no Not reviewed label, and
-- whether apps from other hosts may connect at all. Seeded with the hosts whose client ID metadata documents were read
-- and checked on 7 October 2026.
create table identity_app_host (
    host     text        primary key check (host = lower(host) and length(host) between 3 and 253),
    added_at timestamptz not null default now()
);

insert into identity_app_host (host) values
    ('claude.ai'), ('claude.com'), ('chatgpt.com'), ('vscode.dev'), ('zed.dev'), ('goose-docs.ai');

create table identity_app_setting (
    id                boolean primary key default true check (id),
    allow_other_hosts boolean not null default true
);

insert into identity_app_setting (id) values (true);
