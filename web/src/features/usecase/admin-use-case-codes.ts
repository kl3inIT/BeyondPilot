import type { AdminUseCase, UseCaseRequirement } from "@/lib/api/generated";

/** The statuses a use case reads as, in the order the filter offers them. */
export const useCaseStatuses = [
  "draft",
  "in_review",
  "needs_changes",
  "approved",
  "closed",
] as const satisfies readonly AdminUseCase["status"][];

/** The industries a use case belongs to, as the backend accepts them. */
export const useCaseIndustries = [
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

/**
 * The kinds of AI the form offers, in the order the two columns read: the left column first. The
 * backend also accepts `other`, which the design does not offer.
 */
export const useCaseTechnologies = [
  "recommendation",
  "predictive_analytics",
  "generative_ai",
  "conversational_ai",
  "computer_vision",
  "document_intelligence",
  "voice_ai",
  "anomaly_detection",
  "knowledge_retrieval",
  "process_automation",
] as const;

/** The preferred timelines the form offers, each as the weeks the backend stores. */
export const timelinePresets = {
  under_4: { min: 1, max: 4 },
  "4_8": { min: 4, max: 8 },
  "8_12": { min: 8, max: 12 },
  "12_24": { min: 12, max: 24 },
  over_24: { min: 24, max: 52 },
} as const;

export const timelineCodes = Object.keys(timelinePresets) as [
  keyof typeof timelinePresets,
  ...(keyof typeof timelinePresets)[],
];

/** What saving does: keep a draft for the organization, or publish at once. */
export const publishChoices = ["draft", "publish"] as const;

export const necessities = [
  "required",
  "optional",
] as const satisfies readonly UseCaseRequirement["necessity"][];
