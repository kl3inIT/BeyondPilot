-- A solution's deck is an uploaded file too. Its purpose is one more of those a file is uploaded for.
alter table storage_file
    drop constraint storage_file_purpose_check,
    add constraint storage_file_purpose_check check (purpose in ('program_image', 'application_file', 'solution_deck'));
