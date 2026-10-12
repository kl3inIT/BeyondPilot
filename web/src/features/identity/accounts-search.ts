import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";
import { pageSize } from "@/lib/page-size";

/** The columns the list sorts by, as its API names them. */
export const accountSortKeys = ["name", "lastSignIn", "created"] as const;

/**
 * What narrows the accounts list, as the URL holds it: `?q=&status=&role=&page=`. The page reads
 * these on the server and the toolbar writes them, so both use this one description. A value at its
 * default is left out of the URL.
 */
export const accountsSearch = {
  q: parseAsString.withDefault(""),
  status: parseAsStringLiteral(["active", "disabled"]),
  role: parseAsStringLiteral(["user", "operator"]),
  sort: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
  size: pageSize,
};

export const loadAccountsSearch = createLoader(accountsSearch);

export type AccountsSearch = Awaited<ReturnType<typeof loadAccountsSearch>>;
