-- The company's v1 product, audience, market and business fields; these are distinct from operator-written backing,
-- from reviewed customer deployments and from the separate enterprise challenges in `use_case`.
alter table solution
    add column product_names text[] not null default '{}',
    add column core_technology text,
    add column infrastructure_used text,
    add column segment_focus text[] not null default '{}',
    add column notable_paying_customers text,
    add column use_case_industries text[] not null default '{}',
    add column use_case_descriptions text,
    add column monetization_model text,
    add column company_funding_status text,
    add column company_funding_raised text,
    add column competitors text;
