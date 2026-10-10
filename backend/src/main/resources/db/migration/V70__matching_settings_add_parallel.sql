-- Matching (BEY-39): how many solutions a run reads at the same time becomes a limit operators set in Admin, with
-- the others. It was deploy configuration (beyondpilot.matching.parallel, 4), which is removed: the row is the
-- only source.
--
-- The default is 8. Measured on 10 October 2026 through the provider route staging uses, with 48 calls: 4, 8 and 16
-- at once each had every call answered, in the same time a call (about 20 seconds), so the time a run takes fell in
-- proportion to how many were read at once. 8 halves a run against 4 and leaves room under the provider's limit,
-- which was not reached at 16; past 16 nothing was measured, so 16 is the most allowed.
alter table matching_settings
    add column parallel integer not null default 8;

alter table matching_settings
    add constraint matching_settings_parallel check (parallel between 1 and 16);
