alter table organization add column team_background text;
alter table organization add constraint organization_team_background_length
    check (team_background is null or char_length(team_background) <= 2000);
