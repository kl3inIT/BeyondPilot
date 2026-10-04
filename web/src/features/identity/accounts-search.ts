import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

/**
 * What narrows the accounts list, as the URL holds it: `?q=&status=&role=&page=`. The page reads
 * these on the server and the toolbar writes them, so both use this one description. A value at its
 * default is left out of the URL.
 */
export const accountsSearch = {
  q: parseAsString.withDefault(""),
  status: parseAsStringLiteral(["active", "disabled"]),
  role: parseAsStringLiteral(["user", "operator"]),
  page: parseAsInteger.withDefault(1),
};

export const loadAccountsSearch = createLoader(accountsSearch);

export type AccountsSearch = Awaited<ReturnType<typeof loadAccountsSearch>>;
