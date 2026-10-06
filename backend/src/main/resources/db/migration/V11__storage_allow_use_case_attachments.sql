-- A use case carries files: its own purpose, so the media types and the size limit are its own.
alter table storage_file drop constraint storage_file_purpose_check;
alter table storage_file add constraint storage_file_purpose_check
    check (purpose in ('program_image', 'application_file', 'use_case_attachment'));
