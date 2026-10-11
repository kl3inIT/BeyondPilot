-- When an operator pinned the solution to the top of the public directory; null while it is not pinned.
-- Pinned solutions come first in the directory, the earliest pinned on top, before the order the reader chose.
alter table solution add column pinned_at timestamptz;
