-- What a talent profile says beyond its first version: a photo, the city, the languages, the industries the person
-- worked in and where they work, as the person states it. Each project says how far it went. Every fact is optional.
alter table talent_profile
    -- A photo belongs to one profile; deleting the profile deletes the file.
    add column photo_file_id uuid unique references storage_file (id),
    add column city          text,
    -- ISO 639-1 codes, in the order the person put them.
    add column languages     text[] not null default '{}',
    -- The codes of the industries organizations and solutions are filed under.
    add column industries    text[] not null default '{}',
    add column works_at      text;

alter table talent_project
    add column stage text check (stage in ('prototype', 'pilot', 'in_production', 'internal_tool'));
