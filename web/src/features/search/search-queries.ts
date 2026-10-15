import { search, type SearchResults } from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";
import { maxSearchPage } from "@/lib/page-size";

import type { SearchParams } from "./search-params";

/** The longest query the backend takes. */
export const MAX_QUERY = 100;

/**
 * What matches the query: the best few of each kind for the All tab, or one page of a kind. Read as
 * the visitor, so a signed-in member also gets a use case budget kept for members, and never kept, so
 * an approval shows at once; null when nothing was asked.
 */
export async function readSearch(params: SearchParams): Promise<SearchResults | null> {
  const q = params.q.trim().slice(0, MAX_QUERY);
  if (!q) {
    return null;
  }
  const { data } = await search({
    ...(await sessionRequest()),
    query: {
      q,
      kind: params.kind ?? undefined,
      page: params.kind ? Math.min(Math.max(1, params.page), maxSearchPage) : undefined,
      size: params.kind ? (params.size ?? undefined) : undefined,
    },
  });
  return data;
}
