import type { FailureWords } from "@/lib/api/failure";

/** What the proposal screens say in their own words: their steps mark no field a refused request points at. */
export const proposalWords = {
  REQUEST_INVALID: "UseCaseProposal.errors.REQUEST_INVALID",
} as const satisfies FailureWords;
