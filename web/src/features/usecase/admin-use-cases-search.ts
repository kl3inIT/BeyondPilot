import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

import { pageSize } from "@/lib/page-size";

import { featuredChoices, useCaseStatuses } from "./admin-use-case-codes";

/** What narrows the operators' list of use cases, as the URL holds it: `?q=&status=&organization=&featured=&page=&size=`. */
export const adminUseCasesSearch = {
  q: parseAsString.withDefault(""),
  status: parseAsStringLiteral(useCaseStatuses),
  organization: parseAsString,
  featured: parseAsStringLiteral(featuredChoices),
  page: parseAsInteger.withDefault(1),
  size: pageSize,
};

export const loadAdminUseCasesSearch = createLoader(adminUseCasesSearch);

export type AdminUseCasesSearch = Awaited<ReturnType<typeof loadAdminUseCasesSearch>>;
