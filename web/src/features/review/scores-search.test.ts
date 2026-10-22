import { describe, expect, it } from "vitest";

import type { ProgramScores } from "@/lib/api/generated";

import { scoresTable, scorerKey, type ScoresSearch } from "./scores-search";

const strict = {
  accountId: "a1",
  name: "Strict",
  email: "strict@x.test",
  role: "reviewer",
} as const;
const generous = {
  accountId: "a2",
  name: "Generous",
  email: "generous@x.test",
  role: "reviewer",
} as const;
const fund = { accountId: "a3", name: "Minh", email: "minh@x.test", role: "operator" } as const;

const data: ProgramScores = {
  scale: 10,
  scorers: [fund, strict, generous],
  applications: [
    {
      id: "p1",
      solution: "RiskRadar",
      organization: "Radar Co",
      reviewStatus: "shortlisted",
      scores: [
        { accountId: "a1", score: 5, conflict: false },
        { accountId: "a2", score: 9, conflict: false },
      ],
      average: 7,
      scored: 2,
      spread: 4,
    },
    {
      id: "p2",
      solution: "ClaimLens",
      organization: "Lens Ltd",
      reviewStatus: "shortlisted",
      scores: [
        { accountId: "a1", score: null, conflict: true },
        { accountId: "a2", score: 8, conflict: false },
        { accountId: "a3", score: 8.4, conflict: false },
      ],
      average: 8.2,
      scored: 2,
      spread: 0.4,
    },
    {
      id: "p3",
      solution: "DocuFlow",
      organization: "Flow",
      reviewStatus: "not_selected",
      scores: [],
      average: null,
      scored: 0,
      spread: null,
    },
  ],
};

const search = (change: Partial<ScoresSearch> = {}): ScoresSearch => ({
  view: "applications",
  tab: "shortlisted",
  q: "",
  sort: "",
  ...change,
});

describe("scoresTable", () => {
  it("lists the shortlist by default, the highest mean first, and counts every tab", () => {
    const table = scoresTable(data, search());
    expect(table.rows.map((row) => row.id)).toEqual(["p2", "p1"]);
    expect(table.counts).toEqual({ all: 3, undecided: 0, shortlisted: 2, not_selected: 1 });
    expect(table.defaultSort).toBe("-average");
  });

  it("sorts by the spread or by one scorer, an application they have not scored last", () => {
    expect(scoresTable(data, search({ sort: "-spread" })).rows.map((row) => row.id)).toEqual([
      "p1",
      "p2",
    ]);
    expect(
      scoresTable(data, search({ tab: "all", sort: scorerKey("a2") })).rows.map((row) => row.id),
    ).toEqual(["p2", "p1", "p3"]);
  });

  it("finds an application by its solution or organization, without accents", () => {
    expect(scoresTable(data, search({ q: "lens" })).rows.map((row) => row.id)).toEqual(["p2"]);
  });

  it("sums up each scorer's work over the applications kept", () => {
    const [minh, first, second] = scoresTable(data, search()).judges;
    expect(minh).toMatchObject({ scored: 1, conflicts: 0, waiting: null, mean: 8.4 });
    expect(first).toMatchObject({ scored: 1, conflicts: 1, waiting: 0, mean: 5 });
    expect(second).toMatchObject({ scored: 2, conflicts: 0, waiting: 0, mean: 8.5 });
  });

  it("marks a spread of a fifth of the scale as wide", () => {
    expect(scoresTable(data, search()).wide).toBe(2);
  });
});
