import { createLoader, parseAsInteger, parseAsString } from "nuqs/server";
import { pageSize } from "@/lib/page-size";

/** The columns a list of members sorts by, as its API names them. */
export const organizationMemberSortKeys = ["role", "joined"] as const;

/** The order of a list of members until the reader chooses: owners first, then as they joined. */
export const defaultMemberSort = "role";

/** Which page of the members the URL holds, and in which order: `?page=&sort=`. */
export const organizationMembersSearch = {
  page: parseAsInteger.withDefault(1),
  size: pageSize,
  sort: parseAsString.withDefault(""),
};

export const loadOrganizationMembersSearch = createLoader(organizationMembersSearch);
