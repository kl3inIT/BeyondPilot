-- A program read from the GenAI Fund calendar on Luma (BEY-190): the Luma event it is, found again at each read, and
-- the image its cover was copied from, so the cover is copied again only when Luma's changes.
alter table program add column luma_event_id text;
alter table program add column luma_cover_url text;
alter table program add constraint program_luma_event_id_key unique (luma_event_id);
