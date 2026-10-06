import { createLoader, parseAsString, parseAsStringLiteral } from "nuqs/server";

import type { ReviewApplicationItem } from "@/lib/api/generated";

/** The tabs of the list: GenAI Fund's decisions for an operator, the caller's own work for a judge. */
export const operatorTabs = ["all", "undecided", "shortlisted", "not_selected"] as const;
export const judgeTabs = ["all", "to_score", "scored"] as const;
const tabs = [...new Set([...operatorTabs, ...judgeTabs])] as const;

/** Who applies, as the list narrows it. */
export const applicantKinds = ["independent_builder", "builder_team", "company"] as const;

/**
 * What narrows a program's applications, as the URL holds it: `?tab=&q=&choice=&kind=`. A program
 * takes tens of applications, so the page reads them all and narrows them here.
 */
export const reviewSearch = {
  tab: parseAsStringLiteral(tabs).withDefault("all"),
  q: parseAsString.withDefault(""),
  choice: parseAsString,
  kind: parseAsStringLiteral(applicantKinds),
};

export const loadReviewSearch = createLoader(reviewSearch);

export type ReviewSearch = Awaited<ReturnType<typeof loadReviewSearch>>;

type Tab = (typeof tabs)[number];

/** A name as a search compares it: lowercase, without Vietnamese or other accents. */
function folded(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").toLowerCase();
}

function inTab(item: ReviewApplicationItem, tab: Tab) {
  switch (tab) {
    case "undecided":
      return item.reviewStatus === "under_review";
    case "shortlisted":
    case "not_selected":
      return item.reviewStatus === tab;
    case "to_score":
      return item.mine === "none";
    case "scored":
      return item.mine !== "none";
    default:
      return true;
  }
}

/** The applications the search selects, and how many each tab holds whatever the search. */
export function narrowApplications(items: ReviewApplicationItem[], search: ReviewSearch) {
  const counts = Object.fromEntries(
    tabs.map((tab) => [tab, items.filter((item) => inTab(item, tab)).length]),
  ) as Record<Tab, number>;
  const text = folded(search.q.trim());
  const shown = items.filter(
    (item) =>
      inTab(item, search.tab) &&
      (!text ||
        folded(item.solutionName).includes(text) ||
        folded(item.organizationName).includes(text)) &&
      (!search.choice || item.choice === search.choice) &&
      (!search.kind ||
        (search.kind === "company"
          ? !["independent_builder", "builder_team"].includes(item.organizationType)
          : item.organizationType === search.kind)),
  );
  return { shown, counts };
}
