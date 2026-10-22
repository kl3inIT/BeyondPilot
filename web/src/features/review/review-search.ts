import {
  createLoader,
  createSerializer,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import type { ReviewApplicationItem } from "@/lib/api/generated";
import { listSort, sortParam, type ListSort } from "@/lib/list-sort";

import { waits } from "./review-queue";

/**
 * The tabs of the list: GenAI Fund's decisions for an operator, the caller's own work for a judge.
 * A judge reads only the shortlist, so their tabs narrow it by what they did.
 */
export const operatorTabs = ["all", "undecided", "shortlisted", "not_selected"] as const;
export const judgeTabs = ["all", "bookmarked", "to_score", "scored"] as const;
const tabs = [...new Set([...operatorTabs, ...judgeTabs])] as const;

/** Who applies, as the list narrows it. */
export const applicantKinds = ["independent_builder", "builder_team", "company"] as const;

/** The columns the list sorts by. The score is the judges' mean, which only an operator reads. */
export const reviewSortKeys = ["applicant", "submitted", "score"] as const;
export type ReviewSortKey = (typeof reviewSortKeys)[number];

/** How many applications a page of the list holds. */
export const REVIEW_PAGE_SIZE = 50;

/**
 * What narrows a program's applications, as the URL holds it: `?tab=&q=&choice=&kind=&sort=&page=`.
 * A program takes up to a few hundred applications, so the page reads them all and narrows, sorts
 * and pages them on the server, never in the browser.
 */
export const reviewSearch = {
  tab: parseAsStringLiteral(tabs).withDefault("all"),
  q: parseAsString.withDefault(""),
  choice: parseAsString,
  kind: parseAsStringLiteral(applicantKinds),
  sort: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
};

export const loadReviewSearch = createLoader(reviewSearch);

export type ReviewSearch = Awaited<ReturnType<typeof loadReviewSearch>>;

/** The search as the query of an address, such as `?tab=shortlisted`; empty when it is the default. */
export const reviewAddress = createSerializer(reviewSearch);

/**
 * The search an application keeps from the list it was opened in, without the page: going on from
 * one application to the next stays in that list's tab, filters and order.
 */
export function listQuery(search: ReviewSearch) {
  return reviewAddress({ ...search, page: 1 });
}

type Tab = (typeof tabs)[number];

/** A name as a search compares it: lowercase, without Vietnamese or other accents. */
function folded(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").toLowerCase();
}

function inTab(item: ReviewApplicationItem, tab: Tab, released: boolean) {
  switch (tab) {
    case "undecided":
      return item.reviewStatus === "under_review";
    case "shortlisted":
      return item.shortlisted;
    case "bookmarked":
      return item.bookmarked;
    case "not_selected":
      return item.reviewStatus === tab;
    case "to_score":
      return waits(item, released);
    case "scored":
      return item.mine === "scored" || item.mine === "conflict";
    default:
      return true;
  }
}

/**
 * The order when the URL names none: for an operator, the highest mean first once any application
 * has a score, since choosing the best is what the list is for; until then, and for a judge, the
 * earliest submitted first.
 */
export function defaultReviewSort(
  items: ReviewApplicationItem[],
  operator: boolean,
): ListSort<ReviewSortKey> {
  return operator && items.some((item) => item.average != null)
    ? { key: "score", desc: true }
    : { key: "submitted", desc: false };
}

/** Compares two applications by one key; an application without a score is last either way. */
function compare(
  a: ReviewApplicationItem,
  b: ReviewApplicationItem,
  sort: ListSort<ReviewSortKey>,
) {
  const turn = sort.desc ? -1 : 1;
  switch (sort.key) {
    case "applicant":
      return turn * a.solutionName.localeCompare(b.solutionName);
    case "submitted":
      return turn * a.submittedAt.localeCompare(b.submittedAt);
    case "score":
      if (a.average == null || b.average == null) {
        return a.average == null ? (b.average == null ? 0 : 1) : -1;
      }
      return turn * (a.average - b.average);
  }
}

/**
 * The applications the search selects in its order, the page of them to show, and how many each
 * tab holds whatever the search. Applications that compare equal keep the order they were
 * submitted in.
 * @param keep an application listed whatever the search, in its place in the order: the one on
 *   show, which a decision can move out of its tab
 */
export function listApplications(
  items: ReviewApplicationItem[],
  search: ReviewSearch,
  operator: boolean,
  released = false,
  keep?: string,
) {
  const fallback = defaultReviewSort(items, operator);
  const keys = operator ? reviewSortKeys : reviewSortKeys.filter((key) => key !== "score");
  const sort = listSort(search.sort, keys, fallback);
  const { shown, counts } = narrowApplications(items, search, released, keep);
  const ordered = [...shown].sort(
    (a, b) => compare(a, b, sort) || a.submittedAt.localeCompare(b.submittedAt),
  );
  const pages = Math.max(1, Math.ceil(ordered.length / REVIEW_PAGE_SIZE));
  const page = Math.min(Math.max(1, search.page), pages);
  return {
    ordered,
    rows: ordered.slice((page - 1) * REVIEW_PAGE_SIZE, page * REVIEW_PAGE_SIZE),
    page,
    pages,
    counts,
    sortKeys: keys,
    defaultSort: sortParam(fallback),
  };
}

/**
 * Where an application stands in the list the search makes, kept in it, and its neighbours there:
 * what Previous, Next and Save and next open.
 */
export function neighbours(
  items: ReviewApplicationItem[],
  search: ReviewSearch,
  operator: boolean,
  released: boolean,
  currentId: string,
) {
  const { ordered } = listApplications(items, search, operator, released, currentId);
  const index = ordered.findIndex((item) => item.id === currentId);
  return {
    position: index + 1,
    total: ordered.length,
    previousId: index > 0 ? ordered[index - 1].id : null,
    nextId: index >= 0 && index + 1 < ordered.length ? ordered[index + 1].id : null,
  };
}

/** The applications the search selects, and how many each tab holds whatever the search. */
function narrowApplications(
  items: ReviewApplicationItem[],
  search: ReviewSearch,
  released: boolean,
  keep?: string,
) {
  const counts = Object.fromEntries(
    tabs.map((tab) => [tab, items.filter((item) => inTab(item, tab, released)).length]),
  ) as Record<Tab, number>;
  const text = folded(search.q.trim());
  const shown = items.filter(
    (item) =>
      item.id === keep ||
      (inTab(item, search.tab, released) &&
        (!text ||
          folded(item.solutionName).includes(text) ||
          folded(item.organizationName).includes(text) ||
          // An operator finds an applicant by part of their email, such as its domain.
          folded(item.email ?? "").includes(text)) &&
        (!search.choice || item.choice === search.choice) &&
        (!search.kind ||
          (search.kind === "company"
            ? !["independent_builder", "builder_team"].includes(item.organizationType)
            : item.organizationType === search.kind))),
  );
  return { shown, counts };
}
