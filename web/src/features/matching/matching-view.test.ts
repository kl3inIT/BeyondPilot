import { describe, expect, it } from "vitest";

import type { MatchingCandidate, MatchingFinding, MatchingRequirement } from "@/lib/api/generated";

import {
  bestQuote,
  constraintsOf,
  coverageOf,
  grouped,
  needsOf,
  recommendedOf,
  requirementName,
  sourceOf,
  statusOf,
  tabsOf,
  unreadOf,
  withNeed,
} from "./matching-view";

/** A claims use case: one required capability, two optional ones and three conditions of delivery. */
const requirements: MatchingRequirement[] = [
  {
    position: 1,
    kind: "capability",
    necessity: "required",
    label: "Read documents",
    statement: "Reads invoices and claim forms and takes out their fields",
    quote: "extract data from invoices and claim forms",
  },
  {
    position: 2,
    kind: "capability",
    necessity: "optional",
    label: "Check rules",
    statement: "Checks each claim against the payment rules",
    quote: "validate against our payment rules",
  },
  {
    position: 3,
    kind: "capability",
    necessity: "optional",
    label: "",
    statement: "Routes a claim to the right approver before it is paid",
    quote: "approval flow before payment",
  },
  {
    position: 4,
    kind: "constraint",
    necessity: "required",
    label: "SAP integration",
    statement: "Connects to SAP S/4HANA",
    quote: "must integrate with SAP",
  },
  {
    position: 5,
    kind: "constraint",
    necessity: "optional",
    label: "Hosted in Vietnam",
    statement: "Keeps the data in Vietnam",
    quote: "data stays in Vietnam",
  },
  {
    position: 6,
    kind: "constraint",
    necessity: "optional",
    label: "ISO 27001",
    statement: "Holds ISO 27001",
    quote: "ISO 27001 certified",
  },
];

const finding = (
  requirement: number | undefined,
  status: MatchingFinding["status"],
  quote = "",
  source = "",
): MatchingFinding => ({
  requirement,
  status,
  quote,
  source,
  reason: status === "not_shown" ? "" : "The quote shows it.",
  quoteState: quote ? "exact" : "none",
});

const candidate = (
  name: string,
  bucket: MatchingCandidate["bucket"],
  findings: MatchingFinding[],
  more: Partial<MatchingCandidate> = {},
): MatchingCandidate => ({
  id: `candidate-${name}`,
  solutionId: `solution-${name}`,
  solutionName: name,
  solutionSlug: name.toLowerCase(),
  bucket,
  decision: "none",
  findings,
  judged: true,
  listed: true,
  origin: "recommended",
  requiredMet: findings.some((one) => one.requirement === 1 && one.status === "met") ? 1 : 0,
  requiredTotal: 1,
  // The backend sends a list; the generated type names one value.
  unread: [] as unknown as MatchingCandidate["unread"],
  ...more,
});

const direct = candidate("Staple", "direct", [
  finding(1, "met", "extracts and verifies the content", "website 2"),
  finding(2, "partly", "flags unusual invoices", "deck p.6"),
  finding(3, "not_shown"),
  finding(4, "met", "SAP connector", "profile"),
]);
const industry = candidate(
  "Sentosa",
  "industry",
  [
    finding(1, "partly", "More than 1K invoices per month", "customer case 1"),
    finding(2, "met", "Double payment", "profile"),
  ],
  {
    decision: "shortlisted",
    industry: finding(undefined, "met", "ABC Heinz uses it", "customer case 1"),
  },
);
const technology = candidate("Docbase", "technology", [finding(1, "partly", "", "")], {
  technology: finding(undefined, "met", "extracting data from PDFs and images", "website"),
});
const none = candidate("OmniShelf", "none", [finding(1, "met", "reads shelf photos", "profile")]);
const removed = candidate(
  "Peakflo",
  "technology",
  [finding(1, "met", "Millions of invoices", "deck p.6")],
  {
    decision: "removed",
    removedReason: "duplicate",
    removedBy: "Lan Tran",
  },
);
const waiting = candidate("Fintelite", "none", [], { judged: false, origin: "added" });

const candidates = [direct, industry, technology, none, removed, waiting];
const needs = needsOf(requirements);

describe("needs", () => {
  it("are the capabilities only, named by their label or the first words of their statement", () => {
    expect(needs).toEqual([
      { position: 1, name: "Read documents", required: true },
      { position: 2, name: "Check rules", required: false },
      { position: 3, name: "Routes a claim to…", required: false },
    ]);
    expect(constraintsOf(requirements).map((one) => one.position)).toEqual([4, 5, 6]);
  });

  it("keep a short statement whole", () => {
    expect(requirementName({ label: " ", statement: "Reads invoices" })).toBe("Reads invoices");
  });
});

describe("tabs and groups", () => {
  it("leave out a candidate judged into no group, and keep one that waits to be judged", () => {
    const tabs = tabsOf(candidates);
    expect(tabs.all.map((one) => one.solutionName)).toEqual([
      "Staple",
      "Sentosa",
      "Docbase",
      "Fintelite",
    ]);
    expect(tabs.shortlist.map((one) => one.solutionName)).toEqual(["Sentosa"]);
    expect(tabs.removed.map((one) => one.solutionName)).toEqual(["Peakflo"]);
  });

  it("count as recommended what is judged, in a group and not removed", () => {
    expect(recommendedOf(candidates).map((one) => one.solutionName)).toEqual([
      "Staple",
      "Sentosa",
      "Docbase",
    ]);
  });

  it("put each candidate in its group, and the unjudged apart", () => {
    const found = grouped(tabsOf(candidates).all);
    expect(found.direct).toEqual([direct]);
    expect(found.industry).toEqual([industry]);
    expect(found.technology).toEqual([technology]);
    expect(found.waiting).toEqual([waiting]);
  });
});

describe("coverage", () => {
  it("covers a need a recommended candidate meets, and counts who meets it or comes near", () => {
    expect(coverageOf(needs, candidates).map(({ best, count }) => ({ best, count }))).toEqual([
      { best: "met", count: 3 },
      { best: "met", count: 2 },
      { best: "not_shown", count: 0 },
    ]);
  });

  it("does not count what a removed candidate or one in no group shows", () => {
    const [first] = coverageOf(needs, [none, removed, technology]);
    expect(first).toMatchObject({ best: "partly", count: 1 });
  });

  it("reads a requirement without a finding as not shown", () => {
    expect(statusOf(technology, 2)).toBe("not_shown");
  });

  it("narrows a list to those that show a need", () => {
    const all = tabsOf(candidates).all;
    expect(withNeed(all, 2).map((one) => one.solutionName)).toEqual(["Staple", "Sentosa"]);
    expect(withNeed(all, 3)).toEqual([]);
    expect(withNeed(all, null)).toEqual(all);
  });
});

describe("the quote of a row", () => {
  it("is of a need the candidate meets, before one it comes near", () => {
    expect(bestQuote(industry, needs)).toEqual({ quote: "Double payment", source: "profile" });
    expect(bestQuote(direct, needs)).toEqual({
      quote: "extracts and verifies the content",
      source: "website 2",
    });
  });

  it("falls back to what shows the industry or the technology, and is absent without any", () => {
    expect(bestQuote(technology, needs)).toEqual({
      quote: "extracting data from PDFs and images",
      source: "website",
    });
    expect(bestQuote(waiting, needs)).toBeUndefined();
  });

  it("never takes the quote of a constraint", () => {
    const onlyConstraint = candidate("Sap", "technology", [
      finding(4, "met", "SAP connector", "profile"),
    ]);
    expect(bestQuote(onlyConstraint, needs)).toBeUndefined();
  });
});

describe("sources", () => {
  it("are read from the backend's labels", () => {
    expect(sourceOf("profile")).toEqual({ kind: "profile" });
    expect(sourceOf("customer case 2")).toEqual({ kind: "customerCase", number: 2 });
    expect(sourceOf("deck p.6")).toEqual({ kind: "deck", page: 6 });
    expect(sourceOf("Deck p. 12")).toEqual({ kind: "deck", page: 12 });
    expect(sourceOf("website 3")).toEqual({ kind: "website" });
    expect(sourceOf("website")).toEqual({ kind: "website" });
    expect(sourceOf("")).toBeUndefined();
    expect(sourceOf("brochure")).toBeUndefined();
  });

  it("without text are a list, whatever shape the answer has", () => {
    expect(unreadOf({ unread: ["deck", "website"] })).toEqual(["deck", "website"]);
    expect(unreadOf({ unread: "deck" })).toEqual(["deck"]);
    expect(unreadOf({ unread: [] })).toEqual([]);
  });
});
