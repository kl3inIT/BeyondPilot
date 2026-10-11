import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

import { useCaseStatuses } from "./admin-use-case-codes";
import { pageSize } from "@/lib/page-size";

/** What narrows the operators' list of use cases, as the URL holds it: `?q=&status=&organization=&page=`. */
export const adminUseCasesSearch = {
  q: parseAsString.withDefault(""),
  status: parseAsStringLiteral(useCaseStatuses),
  organization: parseAsString,
  page: parseAsInteger.withDefault(1),
  size: pageSize,
};

export const loadAdminUseCasesSearch = createLoader(adminUseCasesSearch);

export type AdminUseCasesSearch = Awaited<ReturnType<typeof loadAdminUseCasesSearch>>;
