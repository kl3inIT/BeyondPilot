-- GenAI Fund decides one of two things against a profile: it asks for changes to one that waits for review, or it
-- removes one from the public. Both carry a reason, and the person can correct the profile and send it again. A
-- refusal was one state for both; its rows waited for changes or were taken down, and nothing tells them apart now, so
-- they become a request for changes, which asks the person for the same correction.
alter table talent_profile drop constraint talent_profile_status_check;

update talent_profile set status = 'changes_requested' where status = 'rejected';

alter table talent_profile
    add constraint talent_profile_status_check check (status in ('draft', 'submitted', 'approved',
                                                                 'changes_requested', 'removed'));
