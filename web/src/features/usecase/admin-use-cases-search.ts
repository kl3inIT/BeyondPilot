import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

import { useCaseStatuses } from "./admin-use-case-codes";

/** What narrows the operators' list of use cases, as the URL holds it: `?q=&status=&organization=&page=`. */
export const adminUseCasesSearch = {
  q: parseAsString.withDefault(""),
  status: parseAsStringLiteral(useCaseStatuses),
  organization: parseAsString,
  page: parseAsInteger.withDefault(1),
};

export const loadAdminUseCasesSearch = createLoader(adminUseCasesSearch);

export type AdminUseCasesSearch = Awaited<ReturnType<typeof loadAdminUseCasesSearch>>;
