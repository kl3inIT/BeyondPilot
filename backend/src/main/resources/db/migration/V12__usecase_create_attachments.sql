-- The files of a use case, in the order they were attached. A file belongs to one use case.
create table use_case_attachment (
    use_case_id uuid    not null references use_case (id) on delete cascade,
    position    integer not null,
    file_id     uuid    not null references storage_file (id),
    primary key (use_case_id, position),
    constraint use_case_attachment_file_id_key unique (file_id)
);
