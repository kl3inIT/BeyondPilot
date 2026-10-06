-- A talent profile's photo is a stored file of its own purpose; V3 knew only the first two.
alter table storage_file drop constraint storage_file_purpose_check;
alter table storage_file
    add constraint storage_file_purpose_check check (purpose in ('program_image', 'application_file', 'talent_photo'));
