import type { FailureWords } from "@/lib/api/failure";

/**
 * What the application form says in its own words: where a refusal is met by going on with the form,
 * not by what the general words advise elsewhere.
 */
export const applyWords = {
  ORGANIZATION_ALREADY_MEMBER: "Apply.errors.codes.ORGANIZATION_ALREADY_MEMBER",
  PROPOSAL_CHANGED_MEANWHILE: "Apply.errors.codes.PROPOSAL_CHANGED_MEANWHILE",
  PROPOSAL_SOLUTION_REQUIRED: "Apply.errors.codes.PROPOSAL_SOLUTION_REQUIRED",
} as const satisfies FailureWords;
