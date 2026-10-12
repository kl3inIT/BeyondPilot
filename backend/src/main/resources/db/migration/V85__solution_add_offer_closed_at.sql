-- An offer is closed to new solutions: it is no longer chosen, and the solutions that already come with it keep it.
-- Null while it is open.
alter table offer add column closed_at timestamptz;
