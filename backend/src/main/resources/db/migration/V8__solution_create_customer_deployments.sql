-- One project in which a customer put a solution to work, as its organization tells it. GenAI Fund approves each one
-- before anyone else reads it, and a change to an approved one waits for review again: it is a claim about a customer.
create table solution_customer_deployment (
    id               uuid primary key,
    solution_id      uuid        not null references solution (id) on delete cascade,
    title            text        not null,
    -- Who the customer is, as it may be published: a name, or a description such as "A retail bank in Vietnam".
    customer         text        not null,
    problem          text        not null,
    delivered        text        not null,
    stage            text        not null check (stage in ('pilot', 'production')),
    -- Null is not published.
    channels         text,
    languages        text,
    period           text,
    result           text,
    status           text        not null default 'submitted' check (status in ('submitted', 'approved', 'rejected')),
    decision_reason  text check (decision_reason in ('incomplete', 'unverifiable', 'other')),
    decision_message text,
    decided_at       timestamptz,
    version          bigint      not null default 0,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

-- A solution's page, its card and the operators' queue read the deployments of a solution by their status.
create index solution_customer_deployment_solution_idx on solution_customer_deployment (solution_id, status);
