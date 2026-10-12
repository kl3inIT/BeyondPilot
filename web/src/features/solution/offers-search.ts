import { createLoader, parseAsString, parseAsStringLiteral } from "nuqs/server";

export const offerStates = ["open", "closed"] as const;

/** What narrows the operators' list of offers, as the URL holds it: `?q=&state=`. The list is not paged. */
export const adminOffersSearch = {
  q: parseAsString.withDefault(""),
  state: parseAsStringLiteral(offerStates),
};

export const loadAdminOffersSearch = createLoader(adminOffersSearch);

export type AdminOffersSearch = Awaited<ReturnType<typeof loadAdminOffersSearch>>;
