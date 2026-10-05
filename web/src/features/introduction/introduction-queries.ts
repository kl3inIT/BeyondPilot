import { ApiError } from "@/lib/api/client";
import {
  getReceivedIntroductions,
  listAdminIntroductions,
  type AdminIntroductionList,
  type ReceivedIntroductions,
} from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";

import type { AdminIntroductionsSearch } from "./admin-introductions-search";

/** The requests for an introduction to the caller's organization, or `null` when they belong to none. Server only. */
export async function readReceivedIntroductions(): Promise<ReceivedIntroductions | null> {
  try {
    const { data } = await getReceivedIntroductions(await sessionRequest());
    return data;
  } catch (error) {
    if (error instanceof ApiError && error.code === "INTRODUCTION_NEEDS_ORGANIZATION") {
      return null;
    }
    throw error;
  }
}

/** One page of the requests for an introduction, for the operator behind this request. Server only. */
export async function readAdminIntroductions(
  search: AdminIntroductionsSearch,
): Promise<AdminIntroductionList> {
  const { data } = await listAdminIntroductions({
    ...(await sessionRequest()),
    query: {
      q: search.q.trim().slice(0, 100) || undefined,
      status: search.status ?? undefined,
      page: Math.max(1, search.page),
    },
  });
  return data;
}
