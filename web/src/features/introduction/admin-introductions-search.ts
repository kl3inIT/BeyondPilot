import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";
import { pageSize } from "@/lib/page-size";

/** The states the operators' list can narrow to. */
export const introductionStatuses = ["pending", "replied", "declined"] as const;

/** What narrows the operators' list of requests for an introduction: `?q=&status=&page=`. */
export const adminIntroductionsSearch = {
  q: parseAsString.withDefault(""),
  status: parseAsStringLiteral(introductionStatuses),
  page: parseAsInteger.withDefault(1),
  size: pageSize,
};

export const loadAdminIntroductionsSearch = createLoader(adminIntroductionsSearch);

export type AdminIntroductionsSearch = Awaited<ReturnType<typeof loadAdminIntroductionsSearch>>;
