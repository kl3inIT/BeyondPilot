-- An organization no longer says whether it provides solutions or posts use cases: every approved organization
-- may do both, so the roles it held carry no meaning.
alter table organization
    drop constraint organization_roles_known,
    drop column roles;
