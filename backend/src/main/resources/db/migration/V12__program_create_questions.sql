-- What a program asks applicants beyond what every application holds (BEY-37), in the order the form shows it. An answer
-- names its question by `id`, so the questions are fixed once the program's applications open.
create table program_question (
    program_id uuid    not null references program (id) on delete cascade,
    position   integer not null,
    id         uuid    not null,
    kind       text    not null check (kind in ('short_text', 'long_text', 'single_choice', 'file', 'link', 'confirm')),
    label      text    not null,
    help       text,
    required   boolean not null,
    -- The choices of a `single_choice` question; empty for every other kind.
    options    text[]  not null default '{}',
    -- The longest answer to a text question; null takes the form's default.
    max_length integer check (max_length between 1 and 4000),
    primary key (program_id, position),
    constraint program_question_id_key unique (id)
);
