import type { MessageKey } from "@/hooks/use-notify";
import { ApiError } from "@/lib/api/client";

/** The refusals the introduction screens can meet, each with its own words in the catalog. */
const known = [
  "INTRODUCTION_SOLUTION_NOT_FOUND",
  "INTRODUCTION_NEEDS_ORGANIZATION",
  "INTRODUCTION_ORGANIZATION_NOT_APPROVED",
  "INTRODUCTION_OWN_SOLUTION",
  "INTRODUCTION_ALREADY_PENDING",
  "INTRODUCTION_UNREACHABLE",
  "INTRODUCTION_REQUEST_NOT_FOUND",
  "INTRODUCTION_OWNERS_ONLY",
  "INTRODUCTION_NOT_PENDING",
  "REQUEST_INVALID",
] as const;

/** The words for a failed introduction request: by its code when the screen knows it, general otherwise. */
export function introductionError(error: unknown): MessageKey {
  const code = error instanceof ApiError ? error.code : undefined;
  const match = known.find((candidate) => candidate === code);
  return match ? `Introduction.errors.${match}` : "Introduction.errors.unknown";
}
