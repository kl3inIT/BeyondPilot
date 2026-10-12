import { createLoader, parseAsString } from "nuqs/server";

import type { Reviewer } from "@/lib/api/generated";
import { listSort, sortParam, type ListSort } from "@/lib/list-sort";

/** The columns the judges of a program sort by: the name, the role and how many they scored. */
const reviewerSortKeys = ["reviewer", "role", "assessed"] as const;
type ReviewerSortKey = (typeof reviewerSortKeys)[number];

/**
 * The order when the URL names none, as the server lists the judges: the operators who scored
 * first, then the judges in the order they were invited.
 */
const defaultReviewerSort: ListSort<ReviewerSortKey> = { key: "role", desc: false };

/**
 * The order of a program's judges, as the URL holds it: `?sort=`. A program has a handful of
 * judges, so the page reads them all and sorts them on the server.
 */
const reviewersSearch = {
  sort: parseAsString.withDefault(""),
};

export const loadReviewersSearch = createLoader(reviewersSearch);

export type ReviewersSearch = Awaited<ReturnType<typeof loadReviewersSearch>>;

/** Compares two judges by one key: a judge without a name is compared by their address. */
function compare(a: Reviewer, b: Reviewer, sort: ListSort<ReviewerSortKey>) {
  const turn = sort.desc ? -1 : 1;
  switch (sort.key) {
    case "reviewer":
      return turn * (a.name ?? a.email).localeCompare(b.name ?? b.email);
    case "role":
      return turn * a.role.localeCompare(b.role);
    case "assessed":
      return turn * (a.assessed - b.assessed);
  }
}

/**
 * The judges in the order the search names; judges that compare equal keep the order the server
 * read them in.
 */
export function sortReviewers(items: Reviewer[], search: ReviewersSearch) {
  const sort = listSort(search.sort, reviewerSortKeys, defaultReviewerSort);
  return {
    items: [...items].sort((a, b) => compare(a, b, sort)),
    sortKeys: reviewerSortKeys,
    defaultSort: sortParam(defaultReviewerSort),
  };
}
