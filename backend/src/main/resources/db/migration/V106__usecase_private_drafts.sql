-- A draft GenAI Fund keeps to itself until it publishes it: the members of its organization do not see it
-- (BEY-232). Publishing it ends that.
alter table use_case
    add column operators_only boolean not null default false;

alter table use_case
    add constraint use_case_operators_only_is_draft check (not operators_only or status = 'draft');
