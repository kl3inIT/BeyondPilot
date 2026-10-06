-- What an application reuses from a solution, so it is entered once (BEY-37): its deck, a private PDF; a link to a demo;
-- the models, tools and frameworks it is built with; and its milestones and traction so far.
alter table solution
    add column deck_file_id uuid references storage_file (id),
    add column demo_url     text,
    add column built_with   text[] not null default '{}',
    add column traction     text;
