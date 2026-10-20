import { describe, expect, it } from "vitest";

import {
  decisionTone,
  inBatches,
  inTab,
  ownProposalFileAddress,
  pendingOutcomes,
  proposalFileAddress,
  proposalLine,
  proposalsShown,
} from "./received-proposals";

describe("inBatches", () => {
  it("returns no batch for no identifier", () => {
    expect(inBatches([])).toEqual([]);
  });

  it("splits at 50", () => {
    const ids = Array.from({ length: 120 }, (_, index) => String(index));
    expect(inBatches(ids).map((batch) => batch.length)).toEqual([50, 50, 20]);
  });

  it("keeps exactly 50 in one batch", () => {
    expect(inBatches(Array.from({ length: 50 }, String))).toHaveLength(1);
  });
});

describe("proposalsShown", () => {
  it("counts a published or closed use case, with 0 when it has none", () => {
    expect(proposalsShown("approved", 3)).toBe(3);
    expect(proposalsShown("closed", undefined)).toBe(0);
  });

  it("shows nothing before the use case was published", () => {
    expect(proposalsShown("draft", 2)).toBeNull();
    expect(proposalsShown("in_review", undefined)).toBeNull();
    expect(proposalsShown("needs_changes", 0)).toBeNull();
  });
});

describe("proposalLine", () => {
  it("joins the solutions, then the contact", () => {
    expect(proposalLine(["A", "B"], "Linh")).toBe("A, B · Linh");
  });

  it("leaves out what is missing", () => {
    expect(proposalLine([], "Linh")).toBe("Linh");
    expect(proposalLine(["A"], null)).toBe("A");
    expect(proposalLine([], undefined)).toBe("");
  });
});

describe("proposalFileAddress", () => {
  it("is the file of the proposal under the backend path", () => {
    expect(proposalFileAddress("abc")).toBe("/api/proposal/use-case-proposals/abc/file");
  });
});

describe("ownProposalFileAddress", () => {
  it("is the PDF of the caller's own proposal to the use case", () => {
    expect(ownProposalFileAddress("abc")).toBe("/api/proposal/use-cases/abc/proposal/file");
  });
});

describe("inTab", () => {
  const items = [
    { id: 1, decision: "shortlisted" as const },
    { id: 2, decision: "declined" as const },
    { id: 3, decision: null },
    { id: 4 },
  ];

  it("shows everything under All, the undecided too", () => {
    expect(inTab(items, "all")).toHaveLength(4);
  });

  it("shows only the proposals with that decision", () => {
    expect(inTab(items, "shortlisted").map((item) => item.id)).toEqual([1]);
    expect(inTab(items, "declined").map((item) => item.id)).toEqual([2]);
  });
});

describe("pendingOutcomes", () => {
  it("counts the decisions that were not sent, by kind", () => {
    expect(
      pendingOutcomes([
        { decision: "shortlisted", outcomePending: true },
        { decision: "shortlisted", outcomePending: false },
        { decision: "declined", outcomePending: true },
        { decision: "declined", outcomePending: true },
        { decision: null, outcomePending: false },
      ]),
    ).toEqual({ shortlisted: 1, declined: 2, total: 3 });
  });

  it("is zero without a decision to send", () => {
    expect(pendingOutcomes([{ decision: null }])).toEqual({
      shortlisted: 0,
      declined: 0,
      total: 0,
    });
  });
});

describe("decisionTone", () => {
  it("tells the three states apart", () => {
    expect(decisionTone(null)).toBe("info");
    expect(decisionTone("shortlisted")).toBe("success");
    expect(decisionTone("declined")).toBe("neutral");
  });
});
