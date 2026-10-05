/** A solution is filed under the industries an organization names its own from. */
export { industries } from "@/features/organization/organization-codes";

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
