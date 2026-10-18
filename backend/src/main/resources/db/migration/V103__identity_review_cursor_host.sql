-- Cursor's client ID metadata document on cursor.com, which Cursor's agents and Grok Bot sign in with, was read and
-- checked on 18 October 2026 (BEY-221): its apps connect without a Not reviewed label.
insert into identity_app_host (host) values ('cursor.com') on conflict (host) do nothing;
