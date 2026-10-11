import { ApiError } from "@/lib/api/client";
import {
  countUseCaseProposals,
  getReceivedUseCaseProposal,
  listUseCaseProposals,
  type ReceivedUseCaseProposal,
  type ReceivedUseCaseProposals,
} from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";

import { inBatches } from "./received-proposals";

/** Nothing, in place of a record the caller may not read or an identifier the backend cannot read. */
function absent(error: unknown): null {
  if (error instanceof ApiError && [400, 403, 404].includes(error.status ?? 0)) {
    return null;
  }
  throw error;
}

/** The proposals a use case of the caller's organization received, or `null` when it has none such. Server only. */
export async function readReceivedProposals(
  useCaseId: string,
): Promise<ReceivedUseCaseProposals | null> {
  try {
    const { data } = await listUseCaseProposals({
      ...(await sessionRequest()),
      path: { useCaseId },
    });
    return data;
  } catch (error) {
    return absent(error);
  }
}

/** One proposal a use case of the caller's organization received, or `null`. Server only. */
export async function readReceivedProposal(id: string): Promise<ReceivedUseCaseProposal | null> {
  try {
    const { data } = await getReceivedUseCaseProposal({
      ...(await sessionRequest()),
      path: { id },
    });
    return data;
  } catch (error) {
    return absent(error);
  }
}

/** How many proposals each use case received; public, so no session is needed. Server only. */
export async function readProposalCounts(useCaseIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  await Promise.all(
    inBatches(useCaseIds).map(async (batch) => {
      const { data } = await countUseCaseProposals({
        cache: "no-store",
        query: { useCaseIds: batch },
      });
      for (const item of data.items) {
        counts.set(item.useCaseId, item.received);
      }
    }),
  );
  return counts;
}

/** How many proposals one use case received, or `null` when the count could not be read: the page shows without it. */
export async function readProposalCount(useCaseId: string): Promise<number | null> {
  try {
    return (await readProposalCounts([useCaseId])).get(useCaseId) ?? 0;
  } catch {
    return null;
  }
}
