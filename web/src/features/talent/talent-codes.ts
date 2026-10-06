/** The codes of the talent module, in the order a select or a group of chips offers them. */
export const talentRoles = [
  "ai_engineer",
  "ml_engineer",
  "forward_deployed_engineer",
  "automation_specialist",
  "data_scientist",
  "data_engineer",
  "ai_product_manager",
  "ai_consultant",
  "ai_designer",
  "other",
] as const;

export const availabilities = ["available", "open_to_offers", "not_available"] as const;

export const engagements = ["full_time", "part_time", "contract", "advisory"] as const;

export const rateBands = ["under_25", "25_50", "50_100", "100_150", "150_plus"] as const;

export const talentRejections = ["incomplete", "unverifiable", "inappropriate", "other"] as const;

/** The statuses operators see; a draft is its person's alone. */
export const reviewedStatuses = ["submitted", "approved", "changes_requested", "removed"] as const;
