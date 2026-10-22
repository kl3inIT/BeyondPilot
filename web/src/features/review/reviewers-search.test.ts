import { describe, expect, it } from "vitest";

import type { Reviewer } from "@/lib/api/generated";

import { sortReviewers } from "./reviewers-search";

const reviewer = (
  email: string,
  role: Reviewer["role"],
  assessed: number,
  name: string | null = null,
): Reviewer => ({ email, role, assessed, name, status: "active" });

const judges = [
  reviewer("op@genaifund.ai", "operator", 2, "Zoe"),
  reviewer("lan@judge.vn", "reviewer", 5, "Lan"),
  reviewer("an@judge.vn", "reviewer", 0),
];

const emails = (list: { items: Reviewer[] }) => list.items.map((item) => item.email);

describe("sortReviewers", () => {
  it("keeps the server's order by default: operators first, then judges as invited", () => {
    const list = sortReviewers(judges, { sort: "" });
    expect(list.defaultSort).toBe("role");
    expect(emails(list)).toEqual(["op@genaifund.ai", "lan@judge.vn", "an@judge.vn"]);
  });

  it("sorts by name, or by the address of a judge without one", () => {
    expect(emails(sortReviewers(judges, { sort: "reviewer" }))).toEqual([
      "an@judge.vn",
      "lan@judge.vn",
      "op@genaifund.ai",
    ]);
  });

  it("sorts by how many each scored, and ignores a key it does not know", () => {
    expect(emails(sortReviewers(judges, { sort: "-assessed" }))).toEqual([
      "lan@judge.vn",
      "op@genaifund.ai",
      "an@judge.vn",
    ]);
    expect(emails(sortReviewers(judges, { sort: "email" }))).toEqual(
      emails(sortReviewers(judges, { sort: "" })),
    );
  });
});
