-- When an operator featured the profile; null while it is not featured. Featured profiles come first in the
-- opening view of the public directory, the earliest featured on top: no search, no filter, the newest first.
alter table talent_profile add column featured_at timestamptz;
