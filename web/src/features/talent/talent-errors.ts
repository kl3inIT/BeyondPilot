import type { MessageKey } from "@/hooks/use-notify";
import { ApiError } from "@/lib/api/client";

/** The refusals the talent screens can meet, each with its own words in the catalog. */
const known = [
  "TALENT_PROFILE_NOT_FOUND",
  "TALENT_INCOMPLETE",
  "TALENT_NOT_SUBMITTABLE",
  "TALENT_NOT_AWAITING_REVIEW",
  "TALENT_NOT_APPROVED",
  "TALENT_CHANGED_MEANWHILE",
  "TALENT_OWN_PROFILE",
  "TALENT_ENQUIRY_PENDING",
  "TALENT_ENQUIRY_LIMIT",
  "TALENT_ENQUIRY_NOT_FOUND",
  "TALENT_ENQUIRY_NOT_PENDING",
  "REQUEST_INVALID",
] as const;

/** The words for a failed talent request: by its code when the screen knows it, general otherwise. */
export function talentError(error: unknown): MessageKey {
  const code = error instanceof ApiError ? error.code : undefined;
  const match = known.find((candidate) => candidate === code);
  return match ? `Talent.errors.${match}` : "Talent.errors.unknown";
}
