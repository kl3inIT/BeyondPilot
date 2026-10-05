/** The codes of the solution module, in the order a select or a group of chips offers them. */
export const focusAreas = [
  "conversational_ai",
  "document_processing",
  "computer_vision",
  "speech_voice",
  "predictive_analytics",
  "recommendation",
  "process_automation",
  "ai_agents",
  "generative_content",
  "search_knowledge",
  "data_platform",
  "ai_security",
  "other",
] as const;

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
  "other",
] as const;

export const maturities = ["idea", "prototype", "pilot", "production", "scaled"] as const;

export const deployments = ["cloud_saas", "private_cloud", "on_premise", "hybrid"] as const;

export const solutionRejections = [
  "incomplete",
  "not_an_ai_solution",
  "duplicate",
  "unverifiable",
  "other",
] as const;

export const deploymentStages = ["pilot", "production"] as const;

export const deploymentRejections = ["incomplete", "unverifiable", "other"] as const;

/** The statuses operators see; a draft is its organization's alone. */
export const reviewedStatuses = ["submitted", "approved", "rejected"] as const;
