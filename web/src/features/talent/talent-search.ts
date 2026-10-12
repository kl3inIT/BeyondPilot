import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

import { directorySorts } from "@/lib/directory-sort";
import { pageSize } from "@/lib/page-size";

import { featuredChoices, reviewedStatuses, talentRoles } from "./talent-codes";

/**
 * What narrows the public directory of talent, as the URL holds it:
 * `?q=&role=&sort=&page=&size=`.
 */
export const talentSearch = {
  q: parseAsString.withDefault(""),
  role: parseAsStringLiteral(talentRoles),
  sort: parseAsStringLiteral(directorySorts),
  page: parseAsInteger.withDefault(1),
  size: pageSize,
};

export const loadTalentSearch = createLoader(talentSearch);

export type TalentSearch = Awaited<ReturnType<typeof loadTalentSearch>>;

/** The columns the list sorts by, as its API names them. */
export const adminTalentSortKeys = ["name", "submitted"] as const;

/** What narrows the operators' list of talent profiles: `?q=&status=&featured=&sort=&page=&size=`. */
export const adminTalentSearch = {
  q: parseAsString.withDefault(""),
  status: parseAsStringLiteral(reviewedStatuses),
  featured: parseAsStringLiteral(featuredChoices),
  sort: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
  size: pageSize,
};

export const loadAdminTalentSearch = createLoader(adminTalentSearch);

/** Which page of the reported messages operators read, as the URL holds it: `?page=&size=`. */
export const reportedEnquiriesSearch = { page: parseAsInteger.withDefault(1), size: pageSize };

export const loadReportedEnquiriesSearch = createLoader(reportedEnquiriesSearch);

export type AdminTalentSearch = Awaited<ReturnType<typeof loadAdminTalentSearch>>;
