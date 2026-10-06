-- A use case carries files: its own purpose, so the media types and the size limit are its own. It is one more of
-- those a file is uploaded for, beside the photo of a talent profile that V23 added, the deck of a solution that V24
-- added and the logo of an organization that V29 added.
alter table storage_file
    drop constraint storage_file_purpose_check,
    add constraint storage_file_purpose_check check (purpose in ('program_image', 'application_file', 'talent_photo',
                                                                'solution_deck', 'organization_logo',
                                                                'use_case_attachment'));
