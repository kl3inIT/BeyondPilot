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
const screener = { accountId: "a4", name: "Uyen", email: "uyen@x.test", role: "operator" } as const;

const data: ProgramScores = {
  scale: 10,
  scorers: [fund, screener, strict, generous],
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
      // GenAI Fund's own screening of an application it did not shortlist.
      scores: [{ accountId: "a4", score: 4, conflict: false }],
      average: 4,
      scored: 1,
      spread: null,
    },
  ],
};

const search = (change: Partial<ScoresSearch> = {}): ScoresSearch => ({
  view: "applications",
  q: "",
  sort: "",
  ...change,
});

describe("scoresTable", () => {
  it("lists only the shortlist, which judges score, the highest mean first", () => {
    const table = scoresTable(data, search());
    expect(table.rows.map((row) => row.id)).toEqual(["p2", "p1"]);
    expect(table.shortlisted).toBe(2);
    expect(table.defaultSort).toBe("-average");
  });

  it("leaves out an operator who scored nothing shortlisted, never a judge", () => {
    expect(scoresTable(data, search()).scorers.map((scorer) => scorer.accountId)).toEqual([
      "a3",
      "a1",
      "a2",
    ]);
  });

  it("sorts by the spread or by one scorer, an application they have not scored last", () => {
    expect(scoresTable(data, search({ sort: "-spread" })).rows.map((row) => row.id)).toEqual([
      "p1",
      "p2",
    ]);
    expect(scoresTable(data, search({ sort: scorerKey("a3") })).rows.map((row) => row.id)).toEqual([
      "p2",
      "p1",
    ]);
  });

  it("finds an application by its solution or organization, without accents", () => {
    expect(scoresTable(data, search({ q: "lens" })).rows.map((row) => row.id)).toEqual(["p2"]);
  });

  it("sums up each scorer's work over the shortlist", () => {
    const [minh, first, second] = scoresTable(data, search()).judges;
    expect(minh).toMatchObject({ scored: 1, conflicts: 0, waiting: null, mean: 8.4 });
    expect(first).toMatchObject({ scored: 1, conflicts: 1, waiting: 0, mean: 5 });
    expect(second).toMatchObject({ scored: 2, conflicts: 0, waiting: 0, mean: 8.5 });
  });

  it("marks a spread of a fifth of the scale as wide", () => {
    expect(scoresTable(data, search()).wide).toBe(2);
  });
});
