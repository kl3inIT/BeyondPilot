import type { FailureWords } from "@/lib/api/failure";

/** What the introduction screens say in their own words: the one thing a request can get wrong is its message. */
export const introductionWords = {
  REQUEST_INVALID: "Introduction.errors.REQUEST_INVALID",
} as const satisfies FailureWords;
