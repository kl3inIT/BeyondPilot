import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

import { directorySorts } from "@/lib/directory-sort";

import { pinnedChoices, reviewedStatuses, talentRoles } from "./talent-codes";

/**
 * What narrows the public directory of talent, as the URL holds it:
 * `?q=&role=&sort=&page=`.
 */
export const talentSearch = {
  q: parseAsString.withDefault(""),
  role: parseAsStringLiteral(talentRoles),
  sort: parseAsStringLiteral(directorySorts).withDefault(directorySorts[0]),
  page: parseAsInteger.withDefault(1),
};

export const loadTalentSearch = createLoader(talentSearch);

export type TalentSearch = Awaited<ReturnType<typeof loadTalentSearch>>;

/** What narrows the operators' list of talent profiles: `?q=&status=&pinned=&page=`. */
export const adminTalentSearch = {
  q: parseAsString.withDefault(""),
  status: parseAsStringLiteral(reviewedStatuses),
  pinned: parseAsStringLiteral(pinnedChoices),
  page: parseAsInteger.withDefault(1),
};

export const loadAdminTalentSearch = createLoader(adminTalentSearch);

export type AdminTalentSearch = Awaited<ReturnType<typeof loadAdminTalentSearch>>;
