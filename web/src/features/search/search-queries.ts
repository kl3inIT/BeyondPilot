import { search, type SearchResults } from "@/lib/api/generated";

import type { SearchParams } from "./search-params";

/** The longest query the backend takes. */
export const MAX_QUERY = 100;

/** The deepest page the backend serves; a person refines the query instead of reading further. */
const MAX_PAGE = 50;

/**
 * What matches the query: the best few of each kind for the All tab, or one page of a kind. Read
 * without a session and never kept, so an approval shows at once; null when nothing was asked.
 */
export async function readSearch(params: SearchParams): Promise<SearchResults | null> {
  const q = params.q.trim().slice(0, MAX_QUERY);
  if (!q) {
    return null;
  }
  const { data } = await search({
    cache: "no-store",
    query: {
      q,
      kind: params.kind ?? undefined,
      page: params.kind ? Math.min(Math.max(1, params.page), MAX_PAGE) : undefined,
    },
  });
  return data;
}
