import {
  createLoader,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import { useCaseIndustries } from "./admin-use-case-codes";

/** The orders the list offers; the first is the default and is left out of the URL. */
export const useCaseSorts = ["newest", "deadline", "budget"] as const;

/**
 * What narrows and orders the use case list, as the URL holds it: `?q=&industry=&sort=&page=`. The
 * page reads these on the server and the toolbar writes them, so both use this one description.
 */
export const useCasesSearch = {
  q: parseAsString.withDefault(""),
  industry: parseAsArrayOf(parseAsStringLiteral(useCaseIndustries)).withDefault([]),
  sort: parseAsStringLiteral(useCaseSorts).withDefault("newest"),
  page: parseAsInteger.withDefault(1),
};

export const loadUseCasesSearch = createLoader(useCasesSearch);

export type UseCasesSearch = Awaited<ReturnType<typeof loadUseCasesSearch>>;
