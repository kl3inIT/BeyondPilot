/** The codes of the organization module, in the order a select offers them. */

export const organizationTypes = [
  "company",
  "builder_team",
  "independent_builder",
  "other",
] as const;

export const teamSizes = [
  "just_me",
  "2_9",
  "10_49",
  "50_99",
  "100_499",
  "500_999",
  "1000_4999",
  "5000_plus",
] as const;

/** The industries an organization works in or serves; a solution is filed under the same ones. */
export const industries = [
  "banking_finance",
  "insurance",
  "retail_ecommerce",
  "manufacturing",
  "logistics",
  "healthcare",
  "education",
  "real_estate",
  "telecom",
  "energy",
  "agriculture",
  "travel_hospitality",
  "media_entertainment",
  "public_sector",
  "professional_services",
  "technology",
  "automotive_mobility",
  "consumer_goods",
  "climate_sustainability",
  "marketing_advertising",
  "legal",
  "hr_workforce",
  "other",
] as const;

export const refusalReasons = [
  "duplicate",
  "not_a_real_organization",
  "out_of_scope",
  "other",
] as const;

export const takeDownReasons = [
  "misleading_information",
  "not_a_real_organization",
  "breaks_the_rules",
  "other",
] as const;

/** What the operators' list filters by: each review status, and `suspended` for those taken down. */
export const organizationStatuses = [
  "in_review",
  "needs_changes",
  "approved",
  "rejected",
  "suspended",
] as const;
