import {
  createLoader,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import { useCaseIndustries } from "./admin-use-case-codes";
import { pageSize } from "@/lib/page-size";

/** The orders the list offers; the first is the default and is left out of the URL. */
export const useCaseSorts = ["newest", "deadline", "budget"] as const;
export const useCaseProposalStatuses = ["open", "closed"] as const;

/** A search also offers the order of how well each use case matches; it is never the default. */
const searchSorts = [...useCaseSorts, "relevance"] as const;

/**
 * What narrows and orders the use case list, as the URL holds it: `?q=&industry=&sort=&page=`. The
 * page reads these on the server and the toolbar writes them, so both use this one description.
 */
export const useCasesSearch = {
  q: parseAsString.withDefault(""),
  industry: parseAsArrayOf(parseAsStringLiteral(useCaseIndustries)).withDefault([]),
  proposalStatus: parseAsStringLiteral(useCaseProposalStatuses),
  sort: parseAsStringLiteral(searchSorts),
  page: parseAsInteger.withDefault(1),
  size: pageSize,
};

export const loadUseCasesSearch = createLoader(useCasesSearch);

export type UseCasesSearch = Awaited<ReturnType<typeof loadUseCasesSearch>>;
