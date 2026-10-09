-- Matching (BEY-39): what operators set, runs that people start, and who decided what on a candidate.

-- One row: the limits of matching, set by operators in Admin.
create table matching_settings (
    id                  boolean primary key default true,
    -- How long a use case must stay unchanged before the run its change asked for starts.
    settle_minutes      integer     not null default 10,
    -- How many runs a day the changes of one use case may start.
    edit_runs_per_day   integer     not null default 3,
    -- How many runs a day the members of its organization may start for one use case.
    member_runs_per_day integer     not null default 3,
    -- How many runs a day start in all; null is no limit. A run over it waits for the next day.
    runs_per_day        integer              default 200,
    -- How many solutions a run judges.
    candidates          integer     not null default 40,
    version             bigint      not null default 0,
    updated_at          timestamptz not null default now(),
    constraint matching_settings_single check (id),
    constraint matching_settings_settle check (settle_minutes between 0 and 1440),
    constraint matching_settings_edit_runs check (edit_runs_per_day between 0 and 100),
    constraint matching_settings_member_runs check (member_runs_per_day between 0 and 100),
    constraint matching_settings_runs check (runs_per_day is null or runs_per_day between 1 and 100000),
    constraint matching_settings_candidates check (candidates between 5 and 200)
);

insert into matching_settings default values;

-- A member of the use case's organization may start a run too.
alter table matching_run drop constraint matching_run_origin;
alter table matching_run add constraint matching_run_origin check (origin in ('approved', 'operator', 'member'));

-- A run a change asked for starts only once the use case has stayed unchanged until this moment.
alter table matching_run add column not_before timestamptz;

-- An operator asked for every candidate to be judged again, whatever was judged before.
alter table matching_run add column judge_all boolean not null default false;

-- Who put a candidate there by hand.
alter table matching_candidate add column added_by_account_id uuid;

-- Whether the person who decided was an operator then: a member restores only what members removed.
alter table matching_decision add column by_operator boolean not null default false;
alter table matching_decision add constraint matching_decision_reason
    check (reason is null or reason in ('not_relevant', 'already_known', 'not_credible', 'other'));
