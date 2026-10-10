import type { MessageKey } from "@/hooks/use-notify";
import { ApiError } from "@/lib/api/client";

/** The refusals the candidates screen can meet, each with its own words in the catalog. */
const known = [
  "MATCHING_USE_CASE_NOT_FOUND",
  "MATCHING_CANDIDATE_NOT_FOUND",
  "MATCHING_SOLUTION_NOT_FOUND",
  "MATCHING_OPERATORS_ONLY",
  "MATCHING_NO_MODEL",
  "MATCHING_RUN_OPEN",
  "MATCHING_RUN_LIMIT",
  "MATCHING_CANDIDATE_REMOVED",
  "MATCHING_REMOVED_BY_OPERATOR",
  "MATCHING_ALREADY_CANDIDATE",
  "MATCHING_OWN_SOLUTION",
  "MATCHING_SETTINGS_CHANGED",
  "REQUEST_INVALID",
] as const;

/** The words for a failed matching request: by its code when the screen knows it, general otherwise. */
export function describeMatchingError(error: unknown): MessageKey {
  const code = error instanceof ApiError ? error.code : undefined;
  const found = known.find((candidate) => candidate === code);
  return found ? `Matching.errors.${found}` : "Matching.errors.unknown";
}

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
