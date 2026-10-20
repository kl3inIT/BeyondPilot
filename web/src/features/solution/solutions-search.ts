import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

import { directorySorts } from "@/lib/directory-sort";
import { gridPageSize, pageSize } from "@/lib/page-size";

import {
  focusAreas,
  industries,
  maturities,
  featuredChoices,
  deploymentChoices,
  reviewedStatuses,
} from "./solution-codes";

/** What narrows the public directory, as the URL holds it: `?q=&industry=&focusArea=&maturity=&sort=&page=&size=`. */
export const solutionsSearch = {
  q: parseAsString.withDefault(""),
  industry: parseAsStringLiteral(industries),
  focusArea: parseAsStringLiteral(focusAreas),
  maturity: parseAsStringLiteral(maturities),
  sort: parseAsStringLiteral(directorySorts),
  page: parseAsInteger.withDefault(1),
  size: gridPageSize,
};

export const loadSolutionsSearch = createLoader(solutionsSearch);

export type SolutionsSearch = Awaited<ReturnType<typeof loadSolutionsSearch>>;

/** How many more pages of its solutions a company's public page has loaded: `?more=`. */
export const companySearch = { more: parseAsInteger.withDefault(0) };

export const loadCompanySearch = createLoader(companySearch);

/** The columns the list sorts by, as its API names them. */
export const adminSolutionSortKeys = ["name", "submitted"] as const;

/** What narrows the operators' list of solutions: `?q=&organizationId=&status=&industry=&featured=&deployments=&sort=&page=&size=`. */
export const adminSolutionsSearch = {
  q: parseAsString.withDefault(""),
  organizationId: parseAsString,
  status: parseAsStringLiteral(reviewedStatuses),
  industry: parseAsStringLiteral(industries),
  featured: parseAsStringLiteral(featuredChoices),
  deployments: parseAsStringLiteral(deploymentChoices),
  sort: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
  size: pageSize,
};

export const loadAdminSolutionsSearch = createLoader(adminSolutionsSearch);

export type AdminSolutionsSearch = Awaited<ReturnType<typeof loadAdminSolutionsSearch>>;
