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

/** The line under an organization in the list: the solutions it offers, then its primary contact. */
export function proposalLine(solutionNames: string[], contactName: string | null | undefined) {
  return [solutionNames.join(", "), contactName].filter(Boolean).join(" · ");
}
