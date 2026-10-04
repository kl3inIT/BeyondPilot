import { listAccounts, type AccountList } from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";

import type { AccountsSearch } from "./accounts-search";

/** The longest search the backend takes. */
const MAX_SEARCH = 100;

/**
 * One page of accounts for the operator behind this request. Server only. A hand-edited address may
 * carry a page below 1 or a search that is too long; both are brought within the backend's bounds
 * so the page shows a list and not a failure.
 */
export async function readAccounts(search: AccountsSearch): Promise<AccountList> {
  const { data } = await listAccounts({
    ...(await sessionRequest()),
    query: {
      q: search.q.trim().slice(0, MAX_SEARCH) || undefined,
      status: search.status ?? undefined,
      role: search.role ?? undefined,
      page: Math.max(1, search.page),
    },
  });
  return data;
}
