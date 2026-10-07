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

export const engagements = ["full_time", "part_time", "contract", "advisory"] as const;

/** Skills offered under the skills box, each added with one click; anything else can be typed. */
export const suggestedSkills = [
  "Python",
  "LLM evaluation",
  "RAG",
  "Voice agents",
  "LangGraph",
  "Prompt engineering",
  "MLOps",
  "Computer vision",
] as const;

export const rateBands = ["under_25", "25_50", "50_100", "100_150", "150_plus"] as const;

/** The languages a profile can name, by ISO 639-1 code; the region first. */
export const languageCodes = [
  "vi",
  "en",
  "ja",
  "ko",
  "zh",
  "th",
  "id",
  "ms",
  "hi",
  "fr",
  "de",
  "es",
] as const;

export const projectStages = ["prototype", "pilot", "in_production", "internal_tool"] as const;

export const talentRejections = ["incomplete", "unverifiable", "inappropriate", "other"] as const;

/** The statuses operators see; a draft is its person's alone. */
export const reviewedStatuses = ["in_review", "needs_changes", "approved", "suspended"] as const;
