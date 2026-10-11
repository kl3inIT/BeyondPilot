-- When an operator featured the solution; null while it is not featured. Featured solutions come first in the
-- opening view of the public directory, the earliest featured on top: no search, no filter, the newest first.
alter table solution add column featured_at timestamptz;
