import { notFound } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import {
  getRelease,
  getReviewApplication,
  getReviewCriteria,
  listReviewApplications,
  listReviewers,
  listReviewPrograms,
  type Release,
  type ReviewApplication,
  type ReviewApplications,
  type ReviewCriteria,
  type Reviewers,
  type ReviewPrograms,
} from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";

/**
 * A read that is refused, because the caller does not review this program or no longer may, or
 * that names nothing, shows the not-found page: a judge is not told that another program exists.
 */
function notFoundWhenRefused(error: unknown): never {
  if (error instanceof ApiError && [400, 401, 403, 404].includes(error.status ?? 0)) {
    notFound();
  }
  throw error;
}

/** The programs the person behind this request scores. Server only. */
export async function readReviewPrograms(): Promise<ReviewPrograms> {
  const { data } = await listReviewPrograms(await sessionRequest()).catch(notFoundWhenRefused);
  return data;
}

/** Whether the person behind this request judges any program; a failure counts as none. Server only. */
export async function judgesAnyProgram(): Promise<boolean> {
  try {
    const { data } = await listReviewPrograms({
      ...(await sessionRequest()),
      signal: AbortSignal.timeout(3000),
    });
    return data.items.length > 0;
  } catch {
    return false;
  }
}

/** A program's submitted applications as the caller reviews them. Server only. */
export async function readReviewApplications(programId: string): Promise<ReviewApplications> {
  const { data } = await listReviewApplications({
    ...(await sessionRequest()),
    path: { programId },
  }).catch(notFoundWhenRefused);
  return data;
}

/** One application as it was submitted last, with the caller's assessment. Server only. */
export async function readReviewApplication(id: string): Promise<ReviewApplication> {
  const { data } = await getReviewApplication({ ...(await sessionRequest()), path: { id } }).catch(
    notFoundWhenRefused,
  );
  return data;
}

/** A program's judging criteria. Server only. */
export async function readReviewCriteria(programId: string): Promise<ReviewCriteria> {
  const { data } = await getReviewCriteria({
    ...(await sessionRequest()),
    path: { programId },
  }).catch(notFoundWhenRefused);
  return data;
}

/** A program's judges with their progress. Server only. */
export async function readReviewers(programId: string): Promise<Reviewers> {
  const { data } = await listReviewers({ ...(await sessionRequest()), path: { programId } }).catch(
    notFoundWhenRefused,
  );
  return data;
}

/** What releasing a program's outcomes would send, and whether it can. Server only. */
export async function readRelease(programId: string): Promise<Release> {
  const { data } = await getRelease({ ...(await sessionRequest()), path: { programId } }).catch(
    notFoundWhenRefused,
  );
  return data;
}
