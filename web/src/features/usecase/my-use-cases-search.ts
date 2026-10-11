import { createLoader, parseAsString } from "nuqs/server";

import { proposalsShown } from "@/features/proposal/received-proposals";
import type { MyUseCaseSummary } from "@/lib/api/generated";
import { listSort, sortParam, type ListSort } from "@/lib/list-sort";

/** The columns an organization's use cases sort by: the title, the proposals and the last change. */
const myUseCaseSortKeys = ["useCase", "proposals", "updated"] as const;
type MyUseCaseSortKey = (typeof myUseCaseSortKeys)[number];

/** The order when the URL names none, as the server reads them: the latest changed first. */
const defaultMyUseCaseSort: ListSort<MyUseCaseSortKey> = { key: "updated", desc: true };

/**
 * The order of an organization's use cases, as the URL holds it: `?sort=`. An organization posts a
 * handful of use cases, so the page reads them all and sorts them on the server.
 */
const myUseCasesSearch = {
  sort: parseAsString.withDefault(""),
};

export const loadMyUseCasesSearch = createLoader(myUseCasesSearch);

export type MyUseCasesSearch = Awaited<ReturnType<typeof loadMyUseCasesSearch>>;

/**
 * The use cases in the order the search names. A use case that shows no count of proposals, being
 * unpublished or its count unread, comes last either way; use cases that compare equal keep the
 * order the server read them in.
 * @param proposals how many proposals each published use case received; null when unread
 */
export function sortMyUseCases(
  items: MyUseCaseSummary[],
  proposals: Map<string, number> | null,
  search: MyUseCasesSearch,
) {
  const sort = listSort(search.sort, myUseCaseSortKeys, defaultMyUseCaseSort);
  const turn = sort.desc ? -1 : 1;
  const received = (useCase: MyUseCaseSummary) =>
    proposals === null ? null : proposalsShown(useCase.status, proposals.get(useCase.id));
  const ordered = [...items].sort((a, b) => {
    switch (sort.key) {
      case "useCase":
        return turn * (a.title ?? "").localeCompare(b.title ?? "");
      case "updated":
        return turn * a.updatedAt.localeCompare(b.updatedAt);
      case "proposals": {
        const left = received(a);
        const right = received(b);
        if (left === null || right === null) {
          return left === null ? (right === null ? 0 : 1) : -1;
        }
        return turn * (left - right);
      }
    }
  });
  return {
    items: ordered,
    sortKeys: myUseCaseSortKeys,
    defaultSort: sortParam(defaultMyUseCaseSort),
  };
}
