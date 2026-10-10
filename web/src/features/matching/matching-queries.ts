import { ApiError } from "@/lib/api/client";
import {
  getMatching,
  getMatchingSettings,
  listMatchingFeedback,
  type Matching,
  type MatchingFeedbackList,
  type MatchingSettings,
} from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";

/**
 * The solutions matched to a use case, as the caller may read them, or `null` when the caller has no
 * such use case. Server only.
 */
export async function readMatching(useCaseId: string): Promise<Matching | null> {
  try {
    const { data } = await getMatching({ ...(await sessionRequest()), path: { useCaseId } });
    return data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      return null;
    }
    throw error;
  }
}

/** The limits of matching, for the operator behind this request. Server only. */
export async function readMatchingSettings(): Promise<MatchingSettings> {
  const { data } = await getMatchingSettings(await sessionRequest());
  return data;
}

/** What people said about the groups the AI gave, for the operator behind this request. Server only. */
export async function readMatchingFeedback(page: number): Promise<MatchingFeedbackList> {
  const { data } = await listMatchingFeedback({
    ...(await sessionRequest()),
    query: { page: page > 1 ? page : undefined },
  });
  return data;
}
