import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

import { organizationStatuses } from "./organization-codes";

/** What narrows the operators' list of organizations, as the URL holds it: `?q=&status=&page=`. */
export const adminOrganizationsSearch = {
  q: parseAsString.withDefault(""),
  status: parseAsStringLiteral(organizationStatuses),
  page: parseAsInteger.withDefault(1),
};

export const loadAdminOrganizationsSearch = createLoader(adminOrganizationsSearch);

export type AdminOrganizationsSearch = Awaited<ReturnType<typeof loadAdminOrganizationsSearch>>;
