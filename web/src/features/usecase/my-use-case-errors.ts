import type { FailureWords } from "@/lib/api/failure";

/** What the organization's use case screens say in their own words: what was not saved, and a request their steps mark no field of. */
export const useCaseWords = {
  otherwise: "Organization.useCases.errors.unknown",
  REQUEST_INVALID: "Organization.useCases.errors.REQUEST_INVALID",
} as const satisfies FailureWords;
