-- An organization's logo is an uploaded file, as a talent profile's photo is: the logo address V27 added gives way to
-- the stored file, and its purpose is one more of those a file is uploaded for.
alter table storage_file
    drop constraint storage_file_purpose_check,
    add constraint storage_file_purpose_check check (purpose in ('program_image', 'application_file', 'talent_photo',
                                                                'solution_deck', 'organization_logo'));

alter table organization
    drop column logo_url,
    add column logo_file_id uuid unique references storage_file (id);
