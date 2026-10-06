import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

/** The kinds a search returns, each with a tab of its own. */
export const searchKinds = ["program", "solution", "talent", "use_case"] as const;

export type SearchKind = (typeof searchKinds)[number];

/** A search as the URL holds it: `/search?q=&kind=&page=`; no kind is the All tab. */
export const searchParams = {
  q: parseAsString.withDefault(""),
  kind: parseAsStringLiteral(searchKinds),
  page: parseAsInteger.withDefault(1),
};

export const loadSearchParams = createLoader(searchParams);

export type SearchParams = Awaited<ReturnType<typeof loadSearchParams>>;
