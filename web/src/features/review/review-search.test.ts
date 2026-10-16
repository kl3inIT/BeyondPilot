import { describe, expect, it } from "vitest";

import type { ReviewApplicationItem } from "@/lib/api/generated";

import { listApplications, REVIEW_PAGE_SIZE, type ReviewSearch } from "./review-search";

const item = (id: string, submittedAt: string, average: number | null = null) =>
  ({
    id,
    solutionName: id,
    organizationName: id,
    organizationType: "company",
    submittedAt,
    average,
    reviewStatus: "under_review",
    mine: "none",
    own: false,
  }) as ReviewApplicationItem;

const search = (values: Partial<ReviewSearch> = {}): ReviewSearch => ({
  tab: "all",
  q: "",
  choice: null,
  kind: null,
  sort: "",
  page: 1,
  ...values,
});

const ids = (list: { rows: ReviewApplicationItem[] }) => list.rows.map((row) => row.id);

describe("listApplications", () => {
  const items = [
    item("c", "2026-10-03T00:00:00Z", 3.5),
    item("a", "2026-10-01T00:00:00Z"),
    item("b", "2026-10-02T00:00:00Z", 4.5),
  ];

  it("puts the highest mean first for an operator once any is scored, unscored last", () => {
    const list = listApplications(items, search(), true);
    expect(list.defaultSort).toBe("-score");
    expect(ids(list)).toEqual(["b", "c", "a"]);
  });

  it("keeps an unscored application last whichever way the scores are turned", () => {
    expect(ids(listApplications(items, search({ sort: "score" }), true))).toEqual(["c", "b", "a"]);
  });

  it("lists the earliest submitted first for a judge, who cannot sort by the mean", () => {
    const list = listApplications(items, search({ sort: "-score" }), false);
    expect(list.defaultSort).toBe("submitted");
    expect(list.sortKeys).not.toContain("score");
    expect(ids(list)).toEqual(["a", "b", "c"]);
  });

  it("sorts by the column the URL names, and ignores one it does not know", () => {
    expect(ids(listApplications(items, search({ sort: "-submitted" }), true))).toEqual([
      "c",
      "b",
      "a",
    ]);
    expect(ids(listApplications(items, search({ sort: "budget" }), true))).toEqual(["b", "c", "a"]);
  });

  it("finds an applicant by part of their email, such as its domain", () => {
    const withEmail = [
      { ...item("g", "2026-10-01T00:00:00Z"), email: "gulshan@pragyaa.ai" },
      item("h", "2026-10-02T00:00:00Z"),
    ];
    expect(ids(listApplications(withEmail, search({ q: "Pragyaa" }), true))).toEqual(["g"]);
  });

  it("pages the list, and a page past the end shows the last", () => {
    const many = Array.from({ length: REVIEW_PAGE_SIZE + 3 }, (_, index) =>
      item(
        `x${String(index).padStart(3, "0")}`,
        `2026-10-01T00:${String(index % 60).padStart(2, "0")}:00Z`,
      ),
    );
    const second = listApplications(many, search({ page: 2 }), true);
    expect(second.pages).toBe(2);
    expect(second.rows).toHaveLength(3);
    expect(second.ordered).toHaveLength(REVIEW_PAGE_SIZE + 3);
    expect(listApplications(many, search({ page: 9 }), true).page).toBe(2);
  });
});
