-- When an operator featured the program; null while it is not featured. The home page announces the most recently
-- featured program that is published and still takes applications.
alter table program add column featured_at timestamptz;

-- The announcement featured Nestlé Vietnam AI Reinvention from the code until now; it keeps doing so from the data.
update program set featured_at = now() where slug = 'nestle-vietnam-ai-reinvention';
