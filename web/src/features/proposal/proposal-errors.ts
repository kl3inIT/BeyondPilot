import type { MessageKey } from "@/hooks/use-notify";
import { ApiError } from "@/lib/api/client";

/** The refusals the proposal screens can meet, each with its own words in the catalog. */
const known = [
  "PROPOSAL_USE_CASE_NOT_FOUND",
  "PROPOSAL_USE_CASE_CLOSED",
  "PROPOSAL_OWN_USE_CASE",
  "PROPOSAL_NO_ORGANIZATION",
  "PROPOSAL_ALREADY_IN_ORGANIZATION",
  "PROPOSAL_NOT_FOUND",
  "PROPOSAL_ALREADY_SENT",
  "PROPOSAL_EDIT_WINDOW_CLOSED",
  "PROPOSAL_SOLUTION_REQUIRED",
  "PROPOSAL_SOLUTION_NOT_FOUND",
  "PROPOSAL_APPROACH_REQUIRED",
  "PROPOSAL_PROFILE_INCOMPLETE",
  "PROPOSAL_TEAM_INVALID",
  "PROPOSAL_TEAM_INCOMPLETE",
  "PROPOSAL_PDF_REQUIRED",
  "PROPOSAL_CHANGED_MEANWHILE",
  "REQUEST_INVALID",
] as const;

export type ProposalErrorCode = (typeof known)[number];

/** The code of a refused request when the screens know it. */
export function codeOfProposalError(error: unknown): ProposalErrorCode | undefined {
  const code = error instanceof ApiError ? error.code : undefined;
  return known.find((candidate) => candidate === code);
}

/** The words for a failed proposal request: by its code when the screen knows it, general otherwise. */
export function describeProposalError(error: unknown): MessageKey {
  const code = codeOfProposalError(error);
  return code ? `UseCaseProposal.errors.${code}` : "UseCaseProposal.errors.unknown";
}
