import type { UseCaseProposal, UseCaseProposalForm } from "@/lib/api/generated";

/**
 * What a signed-in visitor may do about a use case on its public page: nothing (it takes no more proposals), read the proposals it received (it is their own
 * organization's), send one, or continue the draft they have. Waiting for GenAI Fund's review of the organization, or having
 * none yet, holds nothing up. A proposal that was taken back is a draft that says when it was.
 */
export type SenderAccess =
  | { kind: "hidden" }
  | { kind: "own" }
  | { kind: "open"; draft: boolean; withdrawnAt?: string }
  | { kind: "sent"; proposal: UseCaseProposal };

/** What the form of a use case says the caller may do. */
export function accessOfForm(form: UseCaseProposalForm): SenderAccess {
  if (form.proposal?.status === "sent") {
    return { kind: "sent", proposal: form.proposal };
  }
  const withdrawnAt = form.proposal?.withdrawnAt ?? undefined;
  return { kind: "open", draft: form.proposal != null, ...(withdrawnAt && { withdrawnAt }) };
}

/**
 * What a refused read of the form means. The caller's own use case offers the way to the proposals it received, and one that takes no more
 * proposals offers nothing; any other failure must not take the page's actions away, so the
 * buttons stay and the form says what is wrong when it opens.
 */
export function accessOfRefusal(
  status: number | undefined,
  code: string | undefined,
): SenderAccess {
  if (code === "PROPOSAL_OWN_USE_CASE") {
    return { kind: "own" };
  }
  if (code === "PROPOSAL_USE_CASE_CLOSED") {
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

/** Why a sent proposal can no longer be edited. */
export type EditClosedReason = "disabled" | "useCaseClosed" | "windowPassed";

/** Whether the organization may still edit what it sent, until when, or why it may not. */
export type EditState =
  { kind: "editable"; until: string } | { kind: "closed"; reason: EditClosedReason };

/**
 * What the organization may do with a sent proposal. The server decides (`editableUntil` is null when
 * editing is over); the use case's own facts only tell the reader which reason to give.
 */
export function editStateOf(
  proposal: Pick<UseCaseProposal, "editableUntil">,
  useCase: { closesAt?: string | null; proposalEditDays?: number | null },
  now: number = Date.now(),
): EditState {
  if (proposal.editableUntil) {
    return { kind: "editable", until: proposal.editableUntil };
  }
  if (useCase.proposalEditDays === 0) {
    return { kind: "closed", reason: "disabled" };
  }
  if (closedAt(useCase.closesAt, now)) {
    return { kind: "closed", reason: "useCaseClosed" };
  }
  return { kind: "closed", reason: "windowPassed" };
}

/** What the posting organization told the sender about a sent proposal. */
export type Outcome = "shortlisted" | "declined";

/**
 * The outcome the sender knows: only a sent proposal has one, and only once the organization sent
 * it. A decision that was not sent yet is not here, so the sender cannot tell it from none.
 */
export function outcomeOf(proposal: Pick<UseCaseProposal, "status" | "outcome">): Outcome | null {
  return proposal.status === "sent" ? (proposal.outcome ?? null) : null;
}

/** Whether the sender may still edit or take back what it sent: a proposal that was not selected is only read. */
export function mayChange(outcome: Outcome | null): boolean {
  return outcome !== "declined";
}
