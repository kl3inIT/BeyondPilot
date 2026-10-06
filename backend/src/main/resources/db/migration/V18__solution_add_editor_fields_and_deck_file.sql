-- What the four steps of the editor hold beyond the first form: how far the solution has come, what it is built
-- with, the languages it works in and who gets the most from it. All are optional, and the rows that exist start
-- without them.
--
-- The deck becomes an uploaded file the solution names by its identifier, with the name and the size it was uploaded
-- under, so a list or a page shows them without asking the storage module. The link `deck_url` that V11 added on
-- 6 October 2026 is dropped with whatever it held: it was released to staging the same day, and a link cannot be
-- turned into a file. The release before this one reads that column, so going back to it is a restore of the
-- database.
alter table solution
    add column traction              text,
    add column best_customer_profile text,
    add column built_with            text[] not null default '{}',
    add column languages             text[] not null default '{}',
    add column deck_file_id          uuid references storage_file (id),
    add column deck_file_name        text,
    add column deck_size_bytes       bigint,
    add column deck_attached_at      timestamptz,
    drop column deck_url,
    -- A deck belongs to one solution, which removes the file when it stops naming it.
    add constraint solution_deck_file_id_key unique (deck_file_id),
    add constraint solution_deck_whole check (
        (deck_file_id is null) = (deck_file_name is null)
        and (deck_file_id is null) = (deck_size_bytes is null)
        and (deck_file_id is null) = (deck_attached_at is null)),
    add constraint solution_languages_known check (languages <@ array['en', 'vi', 'id', 'ms', 'th', 'fil', 'zh', 'ja',
                                                                      'ko', 'other']::text[]);
