import { describe, expect, it } from "vitest";

import { proposalFindingOf, proposalSourceOf } from "./proposal-evaluation-view";

const names = ["Claims Desk", "Fraud Radar"];

describe("proposalSourceOf", () => {
  it("names what the vendor wrote for the use case", () => {
    expect(proposalSourceOf("proposal", names)).toEqual({ kind: "approach" });
    expect(proposalSourceOf(" Team ", names)).toEqual({ kind: "team" });
    expect(proposalSourceOf("proposal deck p.3", names)).toEqual({ kind: "proposalDeck", page: 3 });
  });

  it("names the solution a source belongs to by its place in the proposal", () => {
    expect(proposalSourceOf("solution 2 deck p.4", names)).toEqual({
      kind: "solution",
      name: "Fraud Radar",
      source: { kind: "deck", page: 4 },
      label: "deck p.4",
    });
    expect(proposalSourceOf("solution 1 website 3", names)).toMatchObject({
      name: "Claims Desk",
      source: { kind: "website" },
    });
    expect(proposalSourceOf("solution 1 customer case 2", names)).toMatchObject({
      source: { kind: "customerCase", number: 2 },
    });
  });

  it("names nothing it cannot place", () => {
    expect(proposalSourceOf("", names)).toBeUndefined();
    expect(proposalSourceOf("solution 3 profile", names)).toBeUndefined();
    expect(proposalSourceOf("solution 1 brochure", names)).toBeUndefined();
    expect(proposalSourceOf("deck p.2", names)).toBeUndefined();
  });
});

describe("proposalFindingOf", () => {
  it("finds the finding of a requirement, and none for a proposal not read", () => {
    const finding = {
      requirement: 2,
      status: "met" as const,
      quote: "q",
      source: "proposal",
      reason: "r",
      quoteState: "exact" as const,
    };
    expect(proposalFindingOf({ findings: [finding] }, 2)).toBe(finding);
    expect(proposalFindingOf({ findings: [finding] }, 1)).toBeUndefined();
    expect(proposalFindingOf(undefined, 2)).toBeUndefined();
  });
});
