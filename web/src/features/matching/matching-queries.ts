import { ApiError } from "@/lib/api/client";
import {
  getMatching,
  getMatchingRun,
  getMatchingSettings,
  getProposalEvaluations,
  listMatchingFeedback,
  listMatchingRuns,
  type Matching,
  type MatchingFeedbackList,
  type MatchingRunDetail,
  type MatchingRunList,
  type MatchingSettings,
  type ProposalEvaluations,
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

/**
 * The proposals a use case received, each set against its requirements by the AI, or `null` when the
 * caller may not read them. Server only.
 */
export async function readProposalEvaluations(
  useCaseId: string,
): Promise<ProposalEvaluations | null> {
  try {
    const { data } = await getProposalEvaluations({
      ...(await sessionRequest()),
      path: { useCaseId },
    });
    return data;
  } catch (error) {
    if (error instanceof ApiError && [400, 403, 404].includes(error.status ?? 0)) {
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
export async function readMatchingFeedback(
  page: number,
  size: number | null,
): Promise<MatchingFeedbackList> {
  const { data } = await listMatchingFeedback({
    ...(await sessionRequest()),
    query: { page: page > 1 ? page : undefined, size: size ?? undefined },
  });
  return data;
}

/** One page of the runs of every use case, for the operator behind this request. Server only. */
export async function readMatchingRuns(
  page: number,
  size: number | null,
): Promise<MatchingRunList> {
  const { data } = await listMatchingRuns({
    ...(await sessionRequest()),
    query: { page: page > 1 ? page : undefined, size: size ?? undefined },
  });
  return data;
}

/** One run in detail, for the operator behind this request; null when there is no such run. Server only. */
export async function readMatchingRun(runId: string): Promise<MatchingRunDetail | null> {
  try {
    const { data } = await getMatchingRun({ ...(await sessionRequest()), path: { runId } });
    return data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
