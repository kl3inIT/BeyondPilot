import type { MessageKey } from "@/hooks/use-notify";
import type { FailureWords } from "@/lib/api/failure";

/** What the candidates screen says in its own words: the one thing a request can get wrong is its reason. */
export const matchingWords = {
  REQUEST_INVALID: "Matching.errors.REQUEST_INVALID",
} as const satisfies FailureWords;

/** Why a run ended as failed, as the backend codes it. */
const failures = [
  "no_model",
  "use_case_not_published",
  "no_capability",
  "request_refused",
  "provider",
] as const;

/** The words for a run that failed: by its kind when the screen knows it, general otherwise. */
export function describeRunFailure(failure: string | undefined): MessageKey {
  const found = failures.find((candidate) => candidate === failure);
  return found ? `Matching.run.failed.${found}` : "Matching.run.failed.unknown";
}
