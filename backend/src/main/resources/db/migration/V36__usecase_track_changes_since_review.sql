-- Whether the members changed a use case after GenAI Fund sent it back; sending it again without a change is refused.
alter table use_case add column changed_since_review boolean not null default false;
