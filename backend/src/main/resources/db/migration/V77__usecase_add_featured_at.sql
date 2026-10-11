-- When an operator featured the use case; null while it is not featured. Featured use cases come first in the
-- opening view of the public list, the earliest featured on top: no search, no filter, the newest first.
alter table use_case add column featured_at timestamptz;
