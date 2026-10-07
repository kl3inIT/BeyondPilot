-- Four industries join the shared list (BEY-74): the old platform files hundreds of providers and use cases under
-- climate, marketing, legal and HR, which the list could only fold into energy, media or professional services.
-- Organizations, solutions and talent check the list in the application; a use case also checks it here.
alter table use_case drop constraint use_case_industry_check;
alter table use_case add constraint use_case_industry_check check (industry in ('banking_finance', 'insurance',
    'retail_ecommerce', 'manufacturing', 'logistics', 'healthcare', 'education', 'real_estate', 'telecom', 'energy',
    'agriculture', 'travel_hospitality', 'media_entertainment', 'public_sector', 'professional_services', 'technology',
    'automotive_mobility', 'consumer_goods', 'climate_sustainability', 'marketing_advertising', 'legal', 'hr_workforce',
    'other'));
