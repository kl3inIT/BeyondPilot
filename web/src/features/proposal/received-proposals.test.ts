import { describe, expect, it } from "vitest";

import { inBatches, proposalFileAddress, proposalLine, proposalsShown } from "./received-proposals";

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
