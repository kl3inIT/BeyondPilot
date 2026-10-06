-- One business problem an organization wants solved with AI, published as an opportunity that providers answer with
-- proposals. An operator can write it for an organization; the organization's own drafting and the review come later,
-- which is why `status` already allows `in_review` and `needs_changes`.
create table use_case (
    id                       uuid primary key,
    -- The organization it is for. Only an approved enterprise can have one; the application checks it.
    organization_id          uuid        not null references organization (id),
    title                    text        not null,
    problem_statement        text        not null,
    industry                 text        not null check (industry in ('banking_finance', 'insurance', 'retail_ecommerce',
                                                                      'manufacturing', 'logistics', 'healthcare',
                                                                      'education', 'real_estate', 'telecom', 'energy',
                                                                      'agriculture', 'travel_hospitality',
                                                                      'media_entertainment', 'public_sector',
                                                                      'professional_services', 'technology',
                                                                      'automotive_mobility', 'consumer_goods',
                                                                      'other')),
    technologies             text[]      not null check (cardinality(technologies) between 1 and 11
                                                         and technologies <@ array['generative_ai', 'conversational_ai',
                                                             'predictive_analytics', 'computer_vision',
                                                             'recommendation', 'document_intelligence', 'voice_ai',
                                                             'anomaly_detection', 'knowledge_retrieval',
                                                             'process_automation', 'other']),
    expected_outcomes        text        not null,
    current_process          text        not null,
    current_solutions        text,
    target_users             text        not null,
    data_readiness           text        not null,
    integration_requirements text        not null,
    -- In US dollars. Both are null while the budget is to be determined: unknown is not zero.
    budget_min               integer,
    budget_max               integer,
    budget_to_be_determined  boolean     not null default false,
    -- Only signed-in members see the amount.
    budget_members_only      boolean     not null default false,
    timeline_min_weeks       integer     not null check (timeline_min_weeks >= 1),
    timeline_max_weeks       integer     not null,
    hide_organization_name   boolean     not null default false,
    status                   text        not null default 'draft'
                                         check (status in ('draft', 'in_review', 'needs_changes', 'published')),
    published_at             timestamptz,
    -- When it stops taking proposals. Once it has passed the use case is closed, which is read from this date and
    -- never stored.
    closes_at                timestamptz not null,
    created_by_account_id    uuid        not null,
    version                  bigint      not null default 0,
    created_at               timestamptz not null default now(),
    updated_at               timestamptz not null default now(),
    constraint use_case_budget_whole check (
        (budget_to_be_determined and budget_min is null and budget_max is null)
        or (not budget_to_be_determined and budget_min >= 0 and budget_max >= budget_min)),
    constraint use_case_timeline_in_order check (timeline_max_weeks >= timeline_min_weeks)
);

-- One thing the solution must do. The list is kept in the order it was written and is replaced as a whole, so a row is
-- known by its place.
create table use_case_requirement (
    use_case_id uuid    not null references use_case (id) on delete cascade,
    position    integer not null,
    statement   text    not null,
    necessity   text    not null check (necessity in ('required', 'optional')),
    primary key (use_case_id, position)
);

create index use_case_organization_id_idx on use_case (organization_id);

-- The operators' list reads the newest first and narrows by status.
create index use_case_status_idx on use_case (status, created_at desc);
