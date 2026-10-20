/** The most use cases the backend counts in one request. */
const BATCH = 50;

/** The identifiers split into the batches one count request takes. */
export function inBatches(ids: string[]): string[][] {
  const batches: string[][] = [];
  for (let start = 0; start < ids.length; start += BATCH) {
    batches.push(ids.slice(start, start + BATCH));
  }
  return batches;
}

/**
 * What the Proposals column of My use cases shows for one row: the count once the use case was
 * published, and nothing before that, when it cannot have received any.
 */
export function proposalsShown(status: string, received: number | undefined): number | null {
  return status === "approved" || status === "closed" ? (received ?? 0) : null;
}

/** Where the PDF of a proposal a use case received is read; only members of the posting organization may. */
export function proposalFileAddress(id: string): string {
  return `/api/proposal/use-case-proposals/${id}/file`;
}

/** Where the PDF of the proposal the caller's organization wrote to a use case is read, a draft or a sent one. */
export function ownProposalFileAddress(useCaseId: string): string {
  return `/api/proposal/use-cases/${useCaseId}/proposal/file`;
}

/** The line under an organization in the list: the solutions it offers, then its primary contact. */
export function proposalLine(solutionNames: string[], contactName: string | null | undefined) {
  return [solutionNames.join(", "), contactName].filter(Boolean).join(" · ");
}

/** What the organization that posted the use case decided about a proposal. */
export type ProposalDecision = "shortlisted" | "declined";

/** The tabs of the received list: everything, or the proposals with one decision. */
export const proposalTabs = ["all", "shortlisted", "declined"] as const;
export type ProposalTab = (typeof proposalTabs)[number];

type Decided = { decision?: ProposalDecision | null; outcomePending?: boolean };

/** The proposals a tab shows, in the order they arrived. */
export function inTab<T extends Decided>(items: T[], tab: ProposalTab): T[] {
  return tab === "all" ? items : items.filter((item) => item.decision === tab);
}

/** How many e-mails the next send queues, and of which kind: only the decisions the sender was not told yet. */
export function pendingOutcomes(items: Decided[]): {
  shortlisted: number;
  declined: number;
  total: number;
} {
  const waiting = items.filter((item) => item.outcomePending && item.decision);
  const shortlisted = waiting.filter((item) => item.decision === "shortlisted").length;
  return { shortlisted, declined: waiting.length - shortlisted, total: waiting.length };
}

/** The tone of a proposal's state in the list: undecided reads as new, a shortlist as good, a decline as quiet. */
export function decisionTone(decision: ProposalDecision | null | undefined) {
  if (decision === "shortlisted") {
    return "success" as const;
  }
  return decision === "declined" ? ("neutral" as const) : ("info" as const);
}
