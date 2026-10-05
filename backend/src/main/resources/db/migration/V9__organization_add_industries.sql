-- The industries an organization works in or serves, as the codes the solutions use. An organization made before this
-- column, or by an operator for a company that is not here yet, has none until an owner saves its profile.
alter table organization
    add column industries text[] not null default '{}';
