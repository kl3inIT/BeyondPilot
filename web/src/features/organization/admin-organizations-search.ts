import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

import { organizationStatuses } from "./organization-codes";

/** The columns the list sorts by, as its API names them. */
export const adminOrganizationSortKeys = ["name", "received"] as const;

/** What narrows the operators' list of organizations, as the URL holds it: `?q=&status=&page=`. */
export const adminOrganizationsSearch = {
  q: parseAsString.withDefault(""),
  status: parseAsStringLiteral(organizationStatuses),
  sort: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
};

export const loadAdminOrganizationsSearch = createLoader(adminOrganizationsSearch);

export type AdminOrganizationsSearch = Awaited<ReturnType<typeof loadAdminOrganizationsSearch>>;
