-- An organization's members write a draft step by step and it is saved as they type, so a draft can lack most of
-- what a published use case holds. The content columns now allow null; a use case that is in review or published must
-- be complete, which `use_case_complete_when_submitted` keeps true whatever the application does.
alter table use_case alter column title drop not null;
alter table use_case alter column problem_statement drop not null;
alter table use_case alter column industry drop not null;
alter table use_case alter column expected_outcomes drop not null;
alter table use_case alter column current_process drop not null;
alter table use_case alter column target_users drop not null;
alter table use_case alter column data_readiness drop not null;
alter table use_case alter column integration_requirements drop not null;
alter table use_case alter column timeline_min_weeks drop not null;
alter table use_case alter column timeline_max_weeks drop not null;
alter table use_case alter column closes_at drop not null;

-- No technology yet is the empty list, not null; the old check demanded at least one.
alter table use_case drop constraint use_case_technologies_check;
alter table use_case alter column technologies set default '{}';
alter table use_case add constraint use_case_technologies_check check (
    cardinality(technologies) <= 11
    and technologies <@ array['generative_ai', 'conversational_ai', 'predictive_analytics', 'computer_vision',
                              'recommendation', 'document_intelligence', 'voice_ai', 'anomaly_detection',
                              'knowledge_retrieval', 'process_automation', 'other']);

-- The budget is known only when it is chosen: undecided with no amount, or a range in order. A draft may have neither.
alter table use_case drop constraint use_case_budget_whole;
alter table use_case add constraint use_case_budget_whole check (
    (budget_to_be_determined and budget_min is null and budget_max is null)
    or (budget_min is null and budget_max is null)
    or (budget_min >= 0 and budget_max >= budget_min));

-- Who last changed it, who sent it for review and when, and what GenAI Fund said when it sent it back or approved it.
alter table use_case add column last_edited_by_account_id uuid;
alter table use_case add column submitted_at timestamptz;
alter table use_case add column submitted_by_account_id uuid;
alter table use_case add column reviewed_at timestamptz;
alter table use_case add column reviewed_by_account_id uuid;
-- The reason an operator gave when sending it back; the organization reads it until it sends the use case again.
alter table use_case add column review_note text;

update use_case set last_edited_by_account_id = created_by_account_id;
alter table use_case alter column last_edited_by_account_id set not null;

alter table use_case add constraint use_case_complete_when_submitted check (
    status in ('draft', 'needs_changes')
    or (title is not null and problem_statement is not null and industry is not null
        and cardinality(technologies) >= 1 and expected_outcomes is not null and current_process is not null
        and target_users is not null and data_readiness is not null and integration_requirements is not null
        and timeline_min_weeks is not null and timeline_max_weeks is not null and closes_at is not null
        and (budget_to_be_determined or budget_min is not null)));

-- A use case in review needs somebody to have sent it.
alter table use_case add constraint use_case_review_has_sender check (
    status <> 'in_review' or (submitted_at is not null and submitted_by_account_id is not null));

-- The members' tab reads one organization's use cases, the most recently touched first.
create index use_case_organization_updated_idx on use_case (organization_id, updated_at desc);
