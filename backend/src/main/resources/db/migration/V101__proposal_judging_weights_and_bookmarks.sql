-- Judging on a 1 to 10 scale with weights the judges do not see (BEY-213). A criterion's weight is its points; a
-- program's criteria all have points or none does, and without points a score stays the mean of the scores.
alter table review_criterion
    add column max_points integer check (max_points between 1 and 100);

-- A judge marks an application to come back to, and may keep a note before scoring it.
alter table proposal_assessment
    add column bookmarked boolean not null default false;

-- Scores saved on the 1 to 5 scale keep what they meant on the 1 to 10 scale.
update proposal_assessment
set scores = (select jsonb_object_agg(score.key, score.value::int * 2) from jsonb_each_text(scores) score)
where scores <> '{}'::jsonb;
