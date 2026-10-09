import { describe, expect, it } from "vitest";

import type { MatchingCandidate, MatchingFinding, MatchingRequirement } from "@/lib/api/generated";

import {
  constraintsOf,
  coverageOf,
  FOLDED_ROWS,
  grouped,
  groupView,
  matchesOf,
  needsOf,
  recommendedOf,
  requirementName,
  rowVerdict,
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
  unread: [],
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
  it("are the capabilities only, named by their label or the first words of their statement, with the statement in full", () => {
    expect(needs).toEqual([
      {
        position: 1,
        name: "Read documents",
        statement: "Reads invoices and claim forms and takes out their fields",
        required: true,
      },
      {
        position: 2,
        name: "Check rules",
        statement: "Checks each claim against the payment rules",
        required: false,
      },
      {
        position: 3,
        name: "Routes a claim to…",
        statement: "Routes a claim to the right approver before it is paid",
        required: false,
      },
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
    expect(tabs.matches.map((one) => one.solutionName)).toEqual([
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
    const found = grouped(tabsOf(candidates).matches);
    expect(found.direct).toEqual([direct]);
    expect(found.industry).toEqual([industry]);
    expect(found.technology).toEqual([technology]);
    expect(found.waiting).toEqual([waiting]);
    expect(found.kept).toEqual([]);
  });

  it("keeps a candidate a person decided on although the last run put it in no group", () => {
    const shortlisted = { ...none, solutionName: "Kept", decision: "shortlisted" as const };
    const gone = { ...none, solutionName: "Gone", decision: "removed" as const };
    const tabs = tabsOf([direct, none, shortlisted, gone]);
    expect(tabs.shortlist).toEqual([shortlisted]);
    expect(tabs.removed).toEqual([gone]);
    expect(grouped(tabs.matches).kept).toEqual([shortlisted]);
    // It is kept, and it is not what the run recommends.
    expect(recommendedOf([direct, none, shortlisted, gone])).toEqual([direct]);
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
    const all = tabsOf(candidates).matches;
    expect(withNeed(all, 2).map((one) => one.solutionName)).toEqual(["Staple", "Sentosa"]);
    expect(withNeed(all, 3)).toEqual([]);
    expect(withNeed(all, null)).toEqual(all);
  });
});

describe("the sentence above the list", () => {
  it("counts what the run recommends, and how many of them are a strong fit", () => {
    expect(matchesOf(candidates)).toEqual({ matches: 3, strong: 1 });
  });

  it("counts no strong fit when the first group is empty", () => {
    expect(matchesOf([industry, technology, waiting])).toEqual({ matches: 2, strong: 0 });
  });

  it("counts nothing before a run recommends anything, and never what was removed or put in no group", () => {
    expect(matchesOf([none, removed, waiting])).toEqual({ matches: 0, strong: 0 });
    expect(matchesOf([])).toEqual({ matches: 0, strong: 0 });
  });
});

describe("a group in the list", () => {
  const closed = { folds: true, opened: false, all: false };

  it("shows every row of the first two groups and of the small ones, however many", () => {
    for (const section of ["direct", "industry", "waiting", "kept"] as const) {
      expect(groupView(section, 12, closed)).toEqual({
        folds: false,
        open: true,
        shown: 12,
        more: 0,
      });
    }
  });

  it("folds the last group to its header until it is opened", () => {
    expect(groupView("technology", 21, closed)).toEqual({
      folds: true,
      open: false,
      shown: 0,
      more: 0,
    });
  });

  it("shows the first rows of the opened group, and the rest on request", () => {
    expect(groupView("technology", 21, { ...closed, opened: true })).toEqual({
      folds: true,
      open: true,
      shown: FOLDED_ROWS,
      more: 21 - FOLDED_ROWS,
    });
    expect(groupView("technology", 21, { folds: true, opened: true, all: true })).toMatchObject({
      shown: 21,
      more: 0,
    });
    expect(groupView("technology", 3, { ...closed, opened: true })).toMatchObject({
      shown: 3,
      more: 0,
    });
  });

  it("does not fold where folding is off, as on the shortlist", () => {
    expect(groupView("technology", 21, { folds: false, opened: false, all: false })).toEqual({
      folds: false,
      open: true,
      shown: 21,
      more: 0,
    });
  });
});

describe("what a row says beyond its group", () => {
  const one = needs.slice(0, 1);

  it("is nothing when the group says it already", () => {
    expect(rowVerdict(direct, one)).toBeUndefined();
    expect(rowVerdict(industry, one)).toBeUndefined();
    expect(rowVerdict(technology, one)).toBeUndefined();
  });

  it("is the status of the one thing asked for when the group does not say it", () => {
    const shownInIndustry = candidate("Shown", "industry", [finding(1, "met", "reads claims")]);
    const nothingInTechnology = candidate("Bare", "technology", []);
    expect(rowVerdict(shownInIndustry, one)).toBe("met");
    expect(rowVerdict(nothingInTechnology, one)).toBe("not_shown");
    // A solution a person keeps is in no group, so the row says what it shows.
    expect(rowVerdict(none, one)).toBe("met");
  });

  it("is nothing for a solution not read yet, and with several things asked for", () => {
    expect(rowVerdict(waiting, one)).toBeUndefined();
    expect(rowVerdict(candidate("Shown", "industry", [finding(1, "met", "x")]), needs)).toBe(
      undefined,
    );
  });

  it("names which of the deck and the website could not be read", () => {
    expect(unreadOf({ unread: [] })).toBeUndefined();
    expect(unreadOf({ unread: ["deck"] })).toBe("deck");
    expect(unreadOf({ unread: ["website"] })).toBe("website");
    expect(unreadOf({ unread: ["website", "deck"] })).toBe("both");
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
});
