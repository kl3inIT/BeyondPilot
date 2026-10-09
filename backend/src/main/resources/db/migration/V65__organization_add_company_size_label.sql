-- Keep the exact company-size band from the v1 export when it does not fit the organization's controlled team-size bands.
-- The controlled `team_size` remains null for a band that would otherwise have to be guessed.
alter table organization
    add column company_size_label text;
