import type { MessageKey } from "@/hooks/use-notify";
import { ApiError } from "@/lib/api/client";

/** The refusals the solution screens can meet, each with its own words in the catalog. */
const known = [
  "SOLUTION_NOT_FOUND",
  "SOLUTION_MEMBER_REQUIRED",
  "SOLUTION_INCOMPLETE",
  "SOLUTION_NOT_SUBMITTABLE",
  "SOLUTION_NOT_A_DRAFT",
  "SOLUTION_NOT_AWAITING_REVIEW",
  "SOLUTION_CHANGED_MEANWHILE",
  "SOLUTION_IMAGE_NOT_USABLE",
  "SOLUTION_DEPLOYMENT_NOT_FOUND",
  "SOLUTION_TOO_MANY_DEPLOYMENTS",
  "SOLUTION_DEPLOYMENT_NOT_AWAITING_REVIEW",
  "SOLUTION_DEPLOYMENT_CHANGED_MEANWHILE",
  "REQUEST_INVALID",
] as const;

/** The words for a failed solution request: by its code when the screen knows it, general otherwise. */
export function solutionError(error: unknown): MessageKey {
  const code = error instanceof ApiError ? error.code : undefined;
  const match = known.find((candidate) => candidate === code);
  return match ? `Solution.errors.${match}` : "Solution.errors.unknown";
}
