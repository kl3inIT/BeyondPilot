-- Where a solution is shown at work (a video or a live demo) and its presentation, as the addresses the owners give.
-- Both are optional: an early-stage provider has neither, and a submission does not need them.
alter table solution
    add column demo_url text,
    add column deck_url text;
