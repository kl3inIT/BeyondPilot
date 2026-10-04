-- One uploaded file. The bytes are in the object store named by `provider`; this row is what is known about them.
create table storage_file (
    id                     uuid primary key,
    provider               text        not null check (provider in ('local', 's3')),
    object_key             text        not null,
    purpose                text        not null check (purpose in ('program_image', 'application_file')),
    public_read            boolean     not null,
    file_name              text        not null,
    media_type             text        not null,
    size_bytes             bigint      not null check (size_bytes > 0),
    status                 text        not null default 'pending' check (status in ('pending', 'stored')),
    uploaded_by_account_id uuid        not null references identity_account (id),
    -- Set for a store that receives the bytes through this application; the ticket carries the token itself.
    upload_token_hash      text,
    upload_expires_at      timestamptz not null,
    created_at             timestamptz not null default now(),
    stored_at              timestamptz,
    constraint storage_file_object_key_key unique (object_key)
);

create index storage_file_uploaded_by_account_id_idx on storage_file (uploaded_by_account_id);

-- The cleanup of abandoned uploads reads the pending files whose ticket has expired.
create index storage_file_pending_idx on storage_file (upload_expires_at) where status = 'pending';
