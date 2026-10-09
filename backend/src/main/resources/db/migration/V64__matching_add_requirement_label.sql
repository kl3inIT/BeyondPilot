-- Matching (BEY-39): a requirement is shown in lists by two or three words, such as "Read documents".
-- Requirements read before this have none; the next run of their use case reads them again, with the new prompt.
alter table matching_requirement add column label text not null default '';
