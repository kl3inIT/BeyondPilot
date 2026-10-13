-- Conversations between a person and the other side they chose to write to: the person behind a talent profile, the
-- organization that offers a solution, or GenAI Fund about a program. The first message of a conversation with someone
-- new waits as a request until the other side answers it; GenAI Fund's conversations are open at once.
create table messaging_conversation (
    id                        uuid primary key,
    kind                      text        not null check (kind in ('talent', 'solution', 'program')),
    -- What the conversation is about, one per kind. A profile its person deletes takes its conversations with it.
    talent_profile_id         uuid references talent_profile (id) on delete cascade,
    solution_id               uuid references solution (id),
    program_id                uuid references program (id),
    -- The name the profile, solution or program had when the conversation started, shown once the page is gone.
    subject_name              text        not null,
    -- Who wrote first, and the organization they belonged to then.
    starter_account_id        uuid        not null references identity_account (id),
    starter_organization_id   uuid references organization (id),
    -- The other side: one person for a talent profile, an organization for a solution, GenAI Fund's operators for a
    -- program, where both are null.
    recipient_account_id      uuid references identity_account (id),
    recipient_organization_id uuid references organization (id),
    status                    text        not null check (status in ('pending', 'accepted', 'declined', 'reported',
                                                                      'closed')),
    created_at                timestamptz not null default now(),
    answered_at               timestamptz,
    answered_by_account_id    uuid references identity_account (id),
    -- When the other side was reminded of a request that waits; a reminder is sent once.
    reminded_at               timestamptz,
    -- When the last message was written, which orders every list of conversations.
    last_message_at           timestamptz not null default now(),
    constraint messaging_conversation_subject_check check (
        (kind = 'talent' and talent_profile_id is not null and solution_id is null and program_id is null
            and recipient_account_id is not null and recipient_organization_id is null)
        or (kind = 'solution' and solution_id is not null and talent_profile_id is null and program_id is null
            and recipient_organization_id is not null and recipient_account_id is null)
        or (kind = 'program' and program_id is not null and talent_profile_id is null and solution_id is null
            and recipient_account_id is null and recipient_organization_id is null))
);

-- A person has at most one conversation that waits or is open with each profile, solution and program.
create unique index messaging_conversation_talent_key on messaging_conversation (starter_account_id, talent_profile_id)
    where status in ('pending', 'accepted') and talent_profile_id is not null;
create unique index messaging_conversation_solution_key on messaging_conversation (starter_account_id, solution_id)
    where status in ('pending', 'accepted') and solution_id is not null;
create unique index messaging_conversation_program_key on messaging_conversation (starter_account_id, program_id)
    where status in ('pending', 'accepted') and program_id is not null;
create index messaging_conversation_starter_idx on messaging_conversation (starter_account_id, last_message_at desc);
create index messaging_conversation_recipient_idx on messaging_conversation (recipient_account_id, last_message_at desc)
    where recipient_account_id is not null;
create index messaging_conversation_organization_idx
    on messaging_conversation (recipient_organization_id, last_message_at desc)
    where recipient_organization_id is not null;
create index messaging_conversation_program_idx on messaging_conversation (last_message_at desc)
    where program_id is not null;
-- The clock finds the requests that wait, the oldest first.
create index messaging_conversation_waiting_idx on messaging_conversation (created_at) where status = 'pending';

-- One message. The sequence orders the messages of every conversation, so a reader asks for what came after the last
-- one they hold.
create table messaging_message (
    id                uuid primary key,
    conversation_id   uuid        not null references messaging_conversation (id) on delete cascade,
    seq               bigint generated always as identity unique,
    sender_account_id uuid        not null references identity_account (id),
    body              text        not null check (char_length(body) between 1 and 2000),
    created_at        timestamptz not null default now()
);

create index messaging_message_conversation_idx on messaging_message (conversation_id, seq);
create index messaging_message_sender_idx on messaging_message (sender_account_id, created_at);

-- How far each reader has read a conversation, and whether they were emailed about what they have not read.
create table messaging_read (
    conversation_id uuid        not null references messaging_conversation (id) on delete cascade,
    account_id      uuid        not null references identity_account (id),
    read_seq        bigint      not null default 0,
    -- When the reader was emailed that unread messages wait; cleared when they read, so one email covers one absence.
    notified_at     timestamptz,
    primary key (conversation_id, account_id)
);
