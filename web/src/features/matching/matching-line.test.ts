import { describe, expect, it } from "vitest";

import type { MatchingCandidate, MatchingFinding } from "@/lib/api/generated";

import { deckPageOf, lineOf, listOrder, reviewable, toEnd, toFront } from "./matching-line";

const candidate = (
  name: string,
  bucket: MatchingCandidate["bucket"],
  more: Partial<MatchingCandidate> = {},
): MatchingCandidate => ({
  id: name,
  solutionId: `solution-${name}`,
  solutionName: name,
  solutionSlug: name.toLowerCase(),
  bucket,
  decision: "none",
  findings: [],
  judged: true,
  listed: true,
  origin: "recommended",
  requiredMet: 0,
  requiredTotal: 1,
  unread: [],
  ...more,
});

const finding = (requirement: number, source: string, more: Partial<MatchingFinding> = {}) =>
  ({
    requirement,
    status: "met",
    quote: `words for ${requirement}`,
    source,
    reason: "The quote shows it.",
    quoteState: "exact",
    ...more,
  }) satisfies MatchingFinding;

const ids = (line: MatchingCandidate[]) => line.map((one) => one.id);
const none = new Set<string>();

describe("the line of the one-by-one review", () => {
  // Found in this order by the run; the list shows them by group.
  const tech = candidate("Tech", "technology");
  const direct = candidate("Direct", "direct");
  const industry = candidate("Industry", "industry");
  const saved = candidate("Saved", "direct", { decision: "shortlisted" });
  const removed = candidate("Removed", "industry", { decision: "removed" });
  const unread = candidate("Unread", "none", { judged: false });
  const nowhere = candidate("Nowhere", "none");
  const all = [tech, direct, industry, saved, removed, unread, nowhere];

  it("holds what waits for a decision, in the order of the list", () => {
    expect(all.filter(reviewable).map((one) => one.id)).toEqual(["Tech", "Direct", "Industry"]);
    expect(listOrder(all)).toEqual(["Direct", "Industry", "Tech"]);
    expect(ids(lineOf(listOrder(all), all, none, "Direct"))).toEqual([
      "Direct",
      "Industry",
      "Tech",
    ]);
  });

  it("puts a card sent to later behind every other, and brings it back to the front by Undo", () => {
    const later = toEnd(["Direct", "Industry", "Tech"], "Direct");
    expect(ids(lineOf(later, all, none, "Industry"))).toEqual(["Industry", "Tech", "Direct"]);
    expect(ids(lineOf(toFront(later, "Direct"), all, none, "Direct"))).toEqual([
      "Direct",
      "Industry",
      "Tech",
    ]);
  });

  it("adds a solution a run has just read at the end, never in front of the card being read", () => {
    const order = ["Industry", "Tech"];
    const arrived = candidate("Arrived", "direct");
    expect(ids(lineOf(order, [...all, arrived], none, "Industry"))).toEqual([
      "Industry",
      "Tech",
      "Direct",
      "Arrived",
    ]);
  });

  it("leaves out what the person sent away until it comes back", () => {
    expect(ids(lineOf(listOrder(all), all, new Set(["Direct"]), "Direct"))).toEqual([
      "Industry",
      "Tech",
    ]);
  });

  it("keeps the card in front when someone else decides on it meanwhile, and drops it once it is gone", () => {
    const decidedElsewhere = { ...direct, decision: "removed" as const };
    const now = [decidedElsewhere, industry, tech];
    expect(ids(lineOf(listOrder(all), now, none, "Direct"))).toEqual([
      "Direct",
      "Industry",
      "Tech",
    ]);
    expect(ids(lineOf(listOrder(all), [industry, tech], none, "Direct"))).toEqual([
      "Industry",
      "Tech",
    ]);
  });
});

describe("the deck page a card opens at", () => {
  const needs = [{ position: 1 }, { position: 2 }];

  it("is that of the first requirement whose words are on a page of the deck", () => {
    const one = candidate("One", "direct", {
      findings: [finding(2, "deck p.6"), finding(1, "website 2")],
    });
    expect(deckPageOf(one, needs)).toEqual({ page: 6, quote: "words for 2" });
    const both = candidate("Both", "direct", {
      findings: [finding(2, "deck p.6"), finding(1, "deck p.3")],
    });
    expect(deckPageOf(both, needs)).toEqual({ page: 3, quote: "words for 1" });
  });

  it("is nothing for an unlisted solution, whose deck nobody may read at its address, or words found elsewhere", () => {
    const hidden = candidate("Hidden", "direct", {
      listed: false,
      findings: [finding(1, "deck p.3")],
    });
    expect(deckPageOf(hidden, needs)).toBeUndefined();
    const elsewhere = candidate("Elsewhere", "direct", {
      findings: [finding(1, "deck p.3", { quoteState: "other_source" })],
    });
    expect(deckPageOf(elsewhere, needs)).toBeUndefined();
  });
});
