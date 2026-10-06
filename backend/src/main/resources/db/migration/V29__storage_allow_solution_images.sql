-- A solution's logo, its cover and the images under the cover are stored files too, read by anyone who has their
-- address, like the photo of a talent profile. The logo has a purpose of its own because it may be smaller.
alter table storage_file
    drop constraint storage_file_purpose_check,
    add constraint storage_file_purpose_check check (purpose in ('program_image', 'application_file', 'talent_photo',
                                                                'solution_deck', 'solution_logo', 'solution_image'));
