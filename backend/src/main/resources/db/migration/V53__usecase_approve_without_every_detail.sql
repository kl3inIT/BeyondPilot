-- A use case that is in review or approved needs its title, problem, industry, expected outcomes and budget. The
-- rest of what V35 required (technologies, current process, target users, data readiness, integration, timeline and
-- close date) may be missing: the old platform's briefs often do not say, and an operator's use case may leave them
-- out (BEY-75). An organization's own submission still needs every part, which the application checks. A use case
-- with no close date is open with no deadline.
alter table use_case drop constraint use_case_complete_when_submitted;

alter table use_case add constraint use_case_complete_when_submitted check (
    status in ('draft', 'needs_changes')
    or (title is not null and problem_statement is not null and industry is not null
        and expected_outcomes is not null
        and (budget_to_be_determined or budget_min is not null)));

