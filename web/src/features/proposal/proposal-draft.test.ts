import { describe, expect, it } from "vitest";

import {
  addMember,
  addSolutions,
  bodyOf,
  detailsComplete,
  incompleteSteps,
  removeMember,
  setPrimary,
  teamComplete,
  valuesOf,
  type ProposalValues,
} from "./proposal-draft";

const full: ProposalValues = {
  solutionIds: ["s1"],
  approach: "It reads claims.",
  deck: { fileId: "f1", fileName: "deck.pdf", sizeBytes: 10 },
  team: [{ accountId: "a1", role: "Lead", primary: true }],
};

describe("proposal draft", () => {
  it("starts empty before anything was saved", () => {
    expect(valuesOf(null)).toEqual({
      solutionIds: [],
      approach: "",
      deck: null,
      team: [],
    });
  });

  it("sends the version the form read", () => {
    expect(bodyOf(full, 3)).toMatchObject({
      solutionIds: ["s1"],
      deckFileId: "f1",
      version: 3,
      team: [{ accountId: "a1", role: "Lead", primary: true }],
    });
    expect(bodyOf(valuesOf(null), null).version).toBeNull();
  });

  it("adds each solution once", () => {
    expect(addSolutions(["a"], ["b", "a", "b"])).toEqual(["a", "b"]);
  });

  it("makes the first member the primary contact and ignores a second add", () => {
    const one = addMember([], "a1", " Lead ");
    expect(one).toEqual([{ accountId: "a1", role: "Lead", primary: true }]);
    expect(addMember(one, "a1", "x")).toBe(one);
    expect(addMember(one, "a2", "Dev")[1].primary).toBe(false);
  });

  it("hands the primary contact on when that person leaves", () => {
    const team = addMember(addMember([], "a1", "Lead"), "a2", "Dev");
    expect(removeMember(team, "a1")).toEqual([{ accountId: "a2", role: "Dev", primary: true }]);
    expect(setPrimary(team, "a2").map((member) => member.primary)).toEqual([false, true]);
  });

  it("takes no team, or asks for roles and exactly one primary contact", () => {
    expect(teamComplete([])).toBe(true);
    expect(teamComplete([{ accountId: "a1", role: " ", primary: true }])).toBe(false);
    expect(teamComplete(full.team)).toBe(true);
  });

  it("lists the steps that lack content", () => {
    expect(incompleteSteps(full, true)).toEqual([]);
    expect(incompleteSteps(valuesOf(null), true)).toEqual(["solutions", "pdf"]);
    expect(incompleteSteps({ ...full, approach: " " }, true)).toEqual(["solutions"]);
    expect(incompleteSteps(full, false)).toEqual(["details"]);
    expect(
      incompleteSteps({ ...full, team: [{ accountId: "a1", role: "", primary: true }] }, true),
    ).toEqual(["team"]);
  });

  it("asks for a name, a country and a number written with its country code", () => {
    const given = { name: "Lan Tran", country: "VN", phone: "+84 912 345 678" };
    expect(detailsComplete(given)).toBe(true);
    expect(detailsComplete({ ...given, name: " " })).toBe(false);
    expect(detailsComplete({ ...given, country: "" })).toBe(false);
    expect(detailsComplete({ ...given, phone: "" })).toBe(false);
    expect(detailsComplete({ ...given, phone: "call me" })).toBe(false);
  });
});
