-- A reviewer no longer declares a conflict of interest (BEY-244, Kai's words of 22 October 2026: "no need for that for
-- now", after a Tasco judge declared one by accident). A conflict held no scores, so averages and counts stay as they
-- were.

-- A conflict that holds nothing else goes: the reviewer has not scored that application, and may now.
delete from proposal_assessment
where conflict
  and scores = '{}'::jsonb
  and note is null
  and not bookmarked;

-- One that keeps a note or a bookmark stays, as an assessment without scores.
alter table proposal_assessment
    drop column conflict;
