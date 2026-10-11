-- The key a solution is read by from a link, whatever its review says. It is not guessable, and it is handed only to
-- those who hold the solution in a proposal; the address of a solution stays the one to share once it is approved.
alter table solution
    add column view_key uuid not null default gen_random_uuid();

create unique index solution_view_key_key on solution (view_key);
