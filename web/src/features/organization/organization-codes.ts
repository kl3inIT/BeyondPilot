/** The codes of the organization module, in the order a select offers them. */
export const organizationRoles = ["provider", "enterprise"] as const;

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

export const refusalReasons = [
  "duplicate",
  "not_a_real_organization",
  "incomplete",
  "out_of_scope",
  "other",
] as const;

export const organizationStatuses = ["pending", "approved", "rejected"] as const;
