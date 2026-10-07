-- One review lifecycle for everything GenAI Fund reviews (BEY-76). A use case GenAI Fund accepted is `approved`, the
-- word every other reviewed kind uses; approving still makes it public at once, which is why `published_at` keeps its
-- name: it records when the use case went public, not a status. A use case has no takedown and no final refusal yet:
-- sending an approved one back already takes it out of the directory.
alter table use_case drop constraint use_case_status_check;

update use_case set status = 'approved' where status = 'published';

alter table use_case
    add constraint use_case_status_check check (status in ('draft', 'in_review', 'needs_changes', 'approved'));
