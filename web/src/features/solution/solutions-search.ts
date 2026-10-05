import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

import { directorySorts } from "@/lib/directory-sort";

import { focusAreas, industries, maturities, reviewedStatuses } from "./solution-codes";

/** What narrows the public directory, as the URL holds it: `?q=&industry=&focusArea=&maturity=&sort=&page=`. */
export const solutionsSearch = {
  q: parseAsString.withDefault(""),
  industry: parseAsStringLiteral(industries),
  focusArea: parseAsStringLiteral(focusAreas),
  maturity: parseAsStringLiteral(maturities),
  sort: parseAsStringLiteral(directorySorts).withDefault(directorySorts[0]),
  page: parseAsInteger.withDefault(1),
};

export const loadSolutionsSearch = createLoader(solutionsSearch);

export type SolutionsSearch = Awaited<ReturnType<typeof loadSolutionsSearch>>;

/** How many more pages of its solutions a company's public page has loaded: `?more=`. */
export const companySearch = { more: parseAsInteger.withDefault(0) };

export const loadCompanySearch = createLoader(companySearch);

/** What narrows the operators' list of solutions: `?q=&status=&page=`. */
export const adminSolutionsSearch = {
  q: parseAsString.withDefault(""),
  status: parseAsStringLiteral(reviewedStatuses),
  page: parseAsInteger.withDefault(1),
};

export const loadAdminSolutionsSearch = createLoader(adminSolutionsSearch);

export type AdminSolutionsSearch = Awaited<ReturnType<typeof loadAdminSolutionsSearch>>;
