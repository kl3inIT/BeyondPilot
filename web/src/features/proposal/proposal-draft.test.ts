import { describe, expect, it } from "vitest";

import {
  addSolutions,
  bodyOf,
  detailsComplete,
  incompleteSteps,
  removeSolution,
  valuesOf,
  youComplete,
  type ProposalValues,
} from "./proposal-draft";

const full: ProposalValues = {
  solutionIds: ["s1"],
  approach: "It reads claims.",
  teamBackground: "",
  deck: { fileId: "f1", fileName: "deck.pdf", sizeBytes: 10 },
};

const given = { name: "Lan Tran", country: "VN", phone: "+84 912 345 678" };

describe("proposal draft", () => {
  it("starts empty before anything was saved", () => {
    expect(valuesOf(null)).toEqual({
      solutionIds: [],
      approach: "",
      teamBackground: "",
      deck: null,
    });
  });

  it("sends the version the form read", () => {
    expect(bodyOf({ ...full, teamBackground: "Four years of claims AI." }, 3)).toEqual({
      solutionIds: ["s1"],
      approach: "It reads claims.",
      teamBackground: "Four years of claims AI.",
      deckFileId: "f1",
      version: 3,
    });
    expect(bodyOf(valuesOf(null), null).version).toBeNull();
  });

  it("adds each solution once and takes one out", () => {
    expect(addSolutions(["a"], ["b", "a", "b"])).toEqual(["a", "b"]);
    expect(removeSolution(["a", "b"], "a")).toEqual(["b"]);
  });

  it("lists the steps that lack content", () => {
    expect(incompleteSteps(full, true)).toEqual([]);
    expect(incompleteSteps(valuesOf(null), true)).toEqual(["solutions"]);
    expect(incompleteSteps({ ...full, approach: " " }, true)).toEqual(["solutions"]);
    expect(incompleteSteps({ ...full, deck: null }, true)).toEqual(["solutions"]);
    expect(incompleteSteps(full, false)).toEqual(["you"]);
  });

  it("asks a team, and only a team, for what it has done", () => {
    const company = { type: "company" as const };
    const team = { type: "builder_team" as const };

    expect(youComplete(full, given, null)).toBe(false);
    expect(youComplete(full, given, company)).toBe(true);
    expect(youComplete(full, given, team)).toBe(false);
    expect(youComplete({ ...full, teamBackground: " " }, given, team)).toBe(false);
    expect(youComplete({ ...full, teamBackground: "Built two." }, given, team)).toBe(true);
    expect(youComplete(full, { ...given, phone: "" }, company)).toBe(false);
  });

  it("asks for a name, a country and a number written with its country code", () => {
    expect(detailsComplete(given)).toBe(true);
    expect(detailsComplete({ ...given, name: " " })).toBe(false);
    expect(detailsComplete({ ...given, country: "" })).toBe(false);
    expect(detailsComplete({ ...given, phone: "" })).toBe(false);
    expect(detailsComplete({ ...given, phone: "call me" })).toBe(false);
    expect(detailsComplete({ ...given, phone: " 0912 345 678 " })).toBe(true);
    expect(detailsComplete({ ...given, phone: "   " })).toBe(false);
  });
});
