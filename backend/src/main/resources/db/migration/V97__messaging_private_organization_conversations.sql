-- Membership in one conversation is granted by an owner of that organization.
-- Existing conversations grant no ordinary member access until an owner adds them.
create table messaging_participant (
    conversation_id uuid not null references messaging_conversation (id) on delete cascade,
    organization_id uuid not null references organization (id) on delete cascade,
    account_id uuid not null references identity_account (id),
    added_by_account_id uuid not null references identity_account (id),
    created_at timestamptz not null default now(),
    primary key (conversation_id, organization_id, account_id),
    constraint messaging_participant_current_member foreign key (organization_id, account_id)
        references organization_member (organization_id, account_id) on update cascade on delete cascade
);
create index messaging_participant_account_idx on messaging_participant (account_id, conversation_id);
-- The old account key would prevent an owner who moves organizations from starting for their new organization.
-- Starts by owners of one organization are serialized by the application and reuse its active conversation.
drop index messaging_conversation_solution_key;
create index messaging_conversation_starter_organization_idx
    on messaging_conversation (starter_organization_id, solution_id)
    where kind = 'solution' and status in ('pending', 'accepted');

-- A conversation between organizations can have several writers on its starter side.
alter table messaging_message add column from_starter boolean;
update messaging_message m set from_starter = (m.sender_account_id = c.starter_account_id)
    from messaging_conversation c where c.id = m.conversation_id;
alter table messaging_message alter column from_starter set not null;

-- Program conversations wait in an assignment queue; operators cannot read their messages until assigned.
alter table messaging_conversation add column program_assignee_account_id uuid references identity_account (id);
create index messaging_conversation_program_assignment_idx
    on messaging_conversation (created_at, id) where kind = 'program';
