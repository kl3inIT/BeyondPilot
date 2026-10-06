-- A profile no longer states whether its person takes on work: the product owner dropped the field on 6 October
-- 2026. What kind of work the person is open to stays, in engagement.
alter table talent_profile drop column availability;
