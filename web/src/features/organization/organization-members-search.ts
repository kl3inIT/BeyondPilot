import { createLoader, parseAsInteger } from "nuqs/server";

/** Which page of the members the URL holds: `?page=`. */
export const organizationMembersSearch = {
  page: parseAsInteger.withDefault(1),
};

export const loadOrganizationMembersSearch = createLoader(organizationMembersSearch);
