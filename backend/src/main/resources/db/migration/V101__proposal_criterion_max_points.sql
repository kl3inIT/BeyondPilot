-- What a criterion is worth (BEY-213): its most points, which the highest of the five levels gives. A program's criteria
-- are all worth points or none is; without points an application's score stays the mean of the levels.
alter table review_criterion
    add column max_points integer check (max_points between 5 and 100 and max_points % 5 = 0);
