-- What a solution shows of itself: a logo, a cover and up to four more images under the cover, each a stored file
-- the solution names by its identifier. The solutions that exist start without any.
--
-- A review now asks for the logo and the cover. A solution sent for review before this keeps its place without
-- them: a save takes nothing a review needs away from it, and does not ask for what it never had.
alter table solution
    add column logo_file_id   uuid references storage_file (id),
    add column cover_file_id  uuid references storage_file (id),
    -- In the order they are shown. A foreign key cannot follow an array; only this module removes these files, and
    -- it does so after the solution stopped naming them.
    add column image_file_ids uuid[] not null default '{}',
    -- An image belongs to one solution, which removes the file when it stops naming it.
    add constraint solution_logo_file_id_key unique (logo_file_id),
    add constraint solution_cover_file_id_key unique (cover_file_id),
    add constraint solution_image_file_ids_at_most check (cardinality(image_file_ids) <= 4);
