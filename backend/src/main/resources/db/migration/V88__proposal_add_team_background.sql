-- A proposal says what the team that sends it has done (BEY-133), as an application to a program does. The table of the
-- people named on a proposal and the primary contact are no longer written or read; the rows stay until the owner
-- decides what becomes of them.
alter table use_case_proposal
    add column team_background text;
