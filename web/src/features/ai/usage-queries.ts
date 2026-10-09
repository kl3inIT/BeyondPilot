import {
  getAiUsageOverview,
  listAiUsageCalls,
  type AiUsageCallList,
  type AiUsageOverview,
} from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";

import type { UsageCallsSearch, UsageOverviewSearch } from "./usage-search";

/** What the calls of a period came to and what is failing, for Admin › AI › Usage. Server only. */
export async function readUsageOverview(search: UsageOverviewSearch): Promise<AiUsageOverview> {
  const { data } = await getAiUsageOverview({
    ...(await sessionRequest()),
    query: { period: search.period, by: search.by },
  });
  return data;
}

/** One page of the calls made to models and OCR services, newest first. Server only. */
export async function readUsageCalls(search: UsageCallsSearch): Promise<AiUsageCallList> {
  const { data } = await listAiUsageCalls({
    ...(await sessionRequest()),
    query: {
      period: search.period,
      task: search.task ?? undefined,
      provider: search.provider ?? undefined,
      model: search.model ?? undefined,
      outcome: search.outcome ?? undefined,
      page: search.page > 1 ? search.page : undefined,
    },
  });
  return data;
}
