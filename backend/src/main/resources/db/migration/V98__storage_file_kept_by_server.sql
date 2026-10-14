-- A file the server fetched itself, such as the cover of an event read from Luma, names no uploader (BEY-190).
alter table storage_file alter column uploaded_by_account_id drop not null;
