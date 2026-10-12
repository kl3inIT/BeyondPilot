-- A customer deployment GenAI Fund could read is no longer deleted by its organization (BEY-142). `withdrawn_at` says
-- its owners took it off their solution: the row and its review stay as they were, nobody but its organization reads
-- it, and restoring clears the column. Only a deployment of a solution still in draft, which no operator was shown,
-- is really deleted. No stored row is withdrawn: what was deleted before this change is gone.
alter table solution_customer_deployment
    add column withdrawn_at timestamptz;
