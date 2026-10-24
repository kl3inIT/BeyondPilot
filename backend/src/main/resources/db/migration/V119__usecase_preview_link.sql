-- The key a private use case is read by from a link, read-only and without signing in. It is not guessable. Null while the
-- link is off; turning it on creates a key and turning it off drops it, so an old link never works again.
alter table use_case
    add column preview_token uuid;

create unique index use_case_preview_token_key on use_case (preview_token) where preview_token is not null;
