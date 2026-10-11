import type { UseCaseProposalForm } from "@/lib/api/generated";

import type { ProposalErrorCode } from "./proposal-errors";

/**
 * What a signed-in visitor may do about a use case on its public page: nothing (it is their own
 * organization's, or it takes no more proposals), send one, continue the draft they have, or
 * nothing yet for a reason shown beside the disabled button.
 */
export type SenderAccess =
  | { kind: "hidden" }
  | { kind: "open"; draft: boolean }
  | { kind: "sent" }
  | { kind: "blocked"; code: ProposalErrorCode };

/** What the form of a use case says the caller may do. */
export function accessOfForm(form: UseCaseProposalForm): SenderAccess {
  if (!form.organization) {
    return { kind: "blocked", code: "PROPOSAL_NO_ORGANIZATION" };
  }
  if (!form.organization.approved) {
    return { kind: "blocked", code: "PROPOSAL_ORGANIZATION_NOT_APPROVED" };
  }
  if (form.proposal?.status === "sent") {
    return { kind: "sent" };
  }
  return { kind: "open", draft: form.proposal != null };
}

/**
 * What a refused read of the form means. The caller's own use case and one that takes no more
 * proposals offer nothing; any other failure must not take the page's actions away, so the
 * buttons stay and the form says what is wrong when it opens.
 */
export function accessOfRefusal(
  status: number | undefined,
  code: string | undefined,
): SenderAccess {
  if (code === "PROPOSAL_OWN_USE_CASE" || code === "PROPOSAL_USE_CASE_CLOSED") {
    return { kind: "hidden" };
  }
  if (code === "PROPOSAL_USE_CASE_NOT_FOUND" || status === 404 || status === 409) {
    return { kind: "hidden" };
  }
  return { kind: "open", draft: false };
}

/** Whether a use case no longer takes proposals because its closing time has passed. */
export function closedAt(closesAt: string | null | undefined, now: number = Date.now()): boolean {
  return closesAt != null && Date.parse(closesAt) <= now;
}
