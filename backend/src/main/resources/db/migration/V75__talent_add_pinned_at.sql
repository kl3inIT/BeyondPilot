-- When an operator pinned the profile to the top of the public directory; null while it is not pinned.
-- Pinned profiles come first in the directory, the earliest pinned on top, before the order the reader chose.
alter table talent_profile add column pinned_at timestamptz;
