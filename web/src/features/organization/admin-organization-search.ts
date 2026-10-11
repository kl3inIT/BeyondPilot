import { createLoader, parseAsInteger, parseAsStringLiteral } from "nuqs/server";
import { pageSize } from "@/lib/page-size";

/** The tabs of an organization's record. */
export const adminOrganizationTabs = ["profile", "members"] as const;

export type AdminOrganizationTab = (typeof adminOrganizationTabs)[number];

/** Which tab of a record, and which page of its members, the URL holds: `?tab=&page=`. */
export const adminOrganizationSearch = {
  tab: parseAsStringLiteral(adminOrganizationTabs).withDefault("profile"),
  page: parseAsInteger.withDefault(1),
  size: pageSize,
};

export const loadAdminOrganizationSearch = createLoader(adminOrganizationSearch);
