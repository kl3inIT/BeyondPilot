-- A use case GenAI Fund approved can be made private and public again by its organization or by GenAI Fund, with no
-- new review: it is `private` while it is hidden and `approved` while it is public. A use case never approved stays
-- a `draft`. Like an approved one, a private use case holds every part the review required, which the existing
-- `use_case_complete_when_submitted` check keeps.
alter table use_case drop constraint use_case_status_check;

alter table use_case
    add constraint use_case_status_check
        check (status in ('draft', 'in_review', 'needs_changes', 'approved', 'private'));
