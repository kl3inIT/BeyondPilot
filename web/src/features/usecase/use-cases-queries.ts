import { listUseCases, type PublicUseCaseList } from "@/lib/api/generated";

import type { UseCasesSearch } from "./use-cases-search";

/** The longest search the backend takes. */
const MAX_SEARCH = 100;

export type UseCaseList = PublicUseCaseList;

/** One page of the public list. Read without a session and never kept: a decision shows at once. */
export async function readUseCases(search: UseCasesSearch): Promise<UseCaseList> {
  const { data } = await listUseCases({
    cache: "no-store",
    query: {
      q: search.q.trim().slice(0, MAX_SEARCH) || undefined,
      industry: search.industry.length === 0 ? undefined : search.industry,
      sort: search.sort,
      page: Math.max(1, search.page),
    },
  });
  return data;
}
