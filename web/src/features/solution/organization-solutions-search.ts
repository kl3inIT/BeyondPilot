import { createLoader, parseAsString } from "nuqs/server";

import type { SolutionSummary } from "@/lib/api/generated";
import { listSort, sortParam, type ListSort } from "@/lib/list-sort";

/** The columns an organization's solutions sort by: the name and the day each last moved. */
const organizationSolutionSortKeys = ["solution", "updated"] as const;

/**
 * The order when the URL names none, as the server reads them: the newest created first, which no
 * column shows, so solutions keep the order they arrive in.
 */
const defaultSort: ListSort<(typeof organizationSolutionSortKeys)[number] | "created"> = {
  key: "created",
  desc: true,
};

/**
 * The order of an organization's solutions, as the URL holds it: `?sort=`. An organization offers a
 * handful of solutions, so the page reads them all and sorts them on the server.
 */
const organizationSolutionsSearch = {
  sort: parseAsString.withDefault(""),
};

export const loadOrganizationSolutionsSearch = createLoader(organizationSolutionsSearch);

export type OrganizationSolutionsSearch = Awaited<
  ReturnType<typeof loadOrganizationSolutionsSearch>
>;

/** The day the Updated column shows: when it was sent while it waits for review, else its last change. */
function shownDay(solution: SolutionSummary) {
  return solution.status === "in_review" && solution.submittedAt
    ? solution.submittedAt
    : solution.updatedAt;
}

/**
 * The solutions in the order the search names; solutions that compare equal keep the order the
 * server read them in.
 */
export function sortOrganizationSolutions(
  items: SolutionSummary[],
  search: OrganizationSolutionsSearch,
) {
  const sort = listSort(search.sort, organizationSolutionSortKeys, defaultSort);
  const turn = sort.desc ? -1 : 1;
  const ordered = [...items].sort((a, b) => {
    switch (sort.key) {
      case "solution":
        return turn * a.name.localeCompare(b.name);
      case "updated":
        return turn * shownDay(a).localeCompare(shownDay(b));
      case "created":
        return 0;
    }
  });
  return {
    items: ordered,
    sortKeys: organizationSolutionSortKeys,
    defaultSort: sortParam(defaultSort),
  };
}
