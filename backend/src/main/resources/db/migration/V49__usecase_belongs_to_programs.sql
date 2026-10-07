-- A use case belongs to the programs that feature it (BEY-75): 167 use cases of the old platform carry a program
-- tag, and a campaign has linked use cases (brief §9). An operator sets them; the public list narrows by one.
create table use_case_program (
    use_case_id uuid not null references use_case (id) on delete cascade,
    program_id  uuid not null references program (id),
    primary key (use_case_id, program_id)
);

-- A program's page reads its use cases.
create index use_case_program_program_id_idx on use_case_program (program_id);
