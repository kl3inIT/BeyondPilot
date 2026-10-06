import type { MessageKey } from "@/hooks/use-notify";
import { ApiError } from "@/lib/api/client";

/** The refusals the organization's use case screens can meet, each with its own words in the catalog. */
const known = [
  "USECASE_NOT_FOUND",
  "USECASE_ENTERPRISE_REQUIRED",
  "USECASE_CHANGED_MEANWHILE",
  "USECASE_NOT_EDITABLE",
  "USECASE_INCOMPLETE",
  "USECASE_NOT_SUBMITTABLE",
  "USECASE_CANNOT_MOVE_TO_DRAFT",
  "USECASE_CLOSES_IN_THE_PAST",
  "USECASE_BUDGET_INCOMPLETE",
  "USECASE_BUDGET_OUT_OF_ORDER",
  "USECASE_TIMELINE_OUT_OF_ORDER",
  "USECASE_ATTACHMENT_NOT_USABLE",
  "REQUEST_INVALID",
] as const;

export type UseCaseErrorCode = (typeof known)[number];

/** The code of a refused request when the screens know it. */
export function codeOfUseCaseError(error: unknown): UseCaseErrorCode | undefined {
  const code = error instanceof ApiError ? error.code : undefined;
  return known.find((candidate) => candidate === code);
}

/** The words for a failed use case request: by its code when the screen knows it, general otherwise. */
export function describeUseCaseError(error: unknown): MessageKey {
  const code = codeOfUseCaseError(error);
  return code ? `Organization.useCases.errors.${code}` : "Organization.useCases.errors.unknown";
}
