import { createLoader, parseAsInteger } from "nuqs/server";
import { pageSize } from "@/lib/page-size";

/** Which page of the members the URL holds: `?page=`. */
export const organizationMembersSearch = {
  page: parseAsInteger.withDefault(1),
  size: pageSize,
};

export const loadOrganizationMembersSearch = createLoader(organizationMembersSearch);
