-- The channels a solution works through, written by its owners with the rest of who it is for.
--
-- And what GenAI Fund says of a solution beside its owners' words: who backs its company, the programme it was
-- selected for and its funding. Operators write the three, and the page shows them as GenAI Fund's, so they are
-- kept apart from what the owners save. The solutions that exist start without any.
alter table solution
    add column channels           text,
    add column backed_by          text,
    add column program            text,
    add column funding            text,
    add column backing_updated_at timestamptz;
