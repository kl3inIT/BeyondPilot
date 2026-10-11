import {
  createLoader,
  createParser,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import { organizationStatuses } from "./organization-codes";
import { pageSize } from "@/lib/page-size";

/** The columns the list sorts by, as its API names them. */
export const adminOrganizationSortKeys = ["name", "received"] as const;

/** A country as the API takes it: ISO 3166-1 alpha-2. */
const COUNTRY = /^[A-Z]{2}$/;

/** A country code; anything else in the address reads as no country. */
const country = createParser({
  parse: (value) => (COUNTRY.test(value) ? value : null),
  serialize: String,
});

/**
 * What narrows the operators' list of organizations, as the URL holds it:
 * `?q=&status=&country=&sort=&page=&size=`.
 */
export const adminOrganizationsSearch = {
  q: parseAsString.withDefault(""),
  status: parseAsStringLiteral(organizationStatuses),
  country,
  sort: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
  size: pageSize,
};

export const loadAdminOrganizationsSearch = createLoader(adminOrganizationsSearch);

export type AdminOrganizationsSearch = Awaited<ReturnType<typeof loadAdminOrganizationsSearch>>;
