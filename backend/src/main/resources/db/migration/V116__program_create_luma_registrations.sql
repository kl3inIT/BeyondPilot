-- How people register for a Luma event on BeyondPilot, read from Luma with the event (BEY-245): whether it takes
-- registrations, approval, seats and waitlist, the questions. Null when people register on Luma.
alter table program
    add column luma_form jsonb;

-- A person's registration for a Luma event, kept before Luma is called and kept for good, as applications are. Luma
-- holds the decision; BeyondPilot keeps what the person sent, sends it to Luma and tells them what became of it.
create table program_luma_registration (
    id              uuid primary key,
    program_id      uuid        not null references program (id),
    account_id      uuid        not null references identity_account (id),
    -- The name and address sent to Luma, as they were when the person registered.
    email           text        not null,
    name            text        not null check (char_length(name) between 1 and 200),
    -- Each answer with its question as asked: [{questionId, label, type, value}].
    answers         jsonb       not null,
    form_version    text        not null,
    -- Where the guest stands on Luma: the status asked for until Luma says otherwise.
    status          text        not null check (status in ('pending_approval', 'approved', 'waitlist', 'declined', 'invited')),
    -- Whether the registration reached Luma: waiting to be sent, sent, or failed for the reason given.
    send_state      text        not null default 'waiting' check (send_state in ('waiting', 'sent', 'failed')),
    send_error      text,
    attempts        integer     not null default 0,
    next_attempt_at timestamptz not null default now(),
    sent_at         timestamptz,
    luma_guest_id   text,
    -- The check-in address Luma gives a guest, drawn as a QR code for a confirmed one.
    check_in_url    text,
    -- An unguessable token in the addresses of the guest's QR code and calendar file, which an email links to.
    ticket          text        not null unique,
    -- The status the person was last emailed about, so each change is told once.
    emailed_status  text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    version         bigint      not null default 0,
    unique (program_id, account_id)
);

create index program_luma_registration_waiting on program_luma_registration (next_attempt_at)
    where send_state = 'waiting';
