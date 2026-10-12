import { describe, expect, it } from "vitest";

import { proposalStepSchemas, stepProblems } from "./proposal-schemas";

/** The rules with each key as its own words, so a test reads which rule spoke. */
const schemas = proposalStepSchemas((key) => key);

const held = {
  solutionIds: ["s1"],
  approach: "It reads claims.",
  deck: { fileId: "f1", fileName: "deck.pdf", sizeBytes: 10 },
  team: [{ accountId: "a1", role: "Lead", primary: true }],
  details: { name: "Lan Tran", country: "VN", phone: "+84 912 345 678" },
  confirmed: false,
};

describe("stepProblems", () => {
  it("refuses nothing in a step that holds what it needs", () => {
    for (const step of ["organization", "solutions", "details", "team", "pdf", "review"]) {
      expect(stepProblems(schemas, step, held)).toBeUndefined();
    }
  });

  it("checks only the step asked about", () => {
    const empty = { ...held, solutionIds: [], approach: " ", deck: null };

    expect(stepProblems(schemas, "team", empty)).toBeUndefined();
    expect(stepProblems(schemas, "organization", empty)).toBeUndefined();
    expect(stepProblems(schemas, "review", empty)).toBeUndefined();
  });

  it("asks for a solution and for the approach, each on its own field", () => {
    expect(stepProblems(schemas, "solutions", { ...held, solutionIds: [], approach: " " })).toEqual(
      { solutionIds: { message: "solution" }, approach: { message: "approach" } },
    );
  });

  it("names the details by their place in the form", () => {
    expect(
      stepProblems(schemas, "details", { ...held, details: { name: " ", country: "", phone: "" } }),
    ).toEqual({
      "details.name": { message: "required" },
      "details.country": { message: "required" },
      "details.phone": { message: "required" },
    });
  });

  it("tells a number that is missing from one that cannot be a number", () => {
    const withPhone = (phone: string) => ({ ...held, details: { ...held.details, phone } });

    expect(stepProblems(schemas, "details", withPhone("call me"))).toEqual({
      "details.phone": { message: "phoneInvalid" },
    });
    expect(stepProblems(schemas, "details", withPhone(" 0912 345 678 "))).toBeUndefined();
  });

  it("holds a missing role against the team, whatever row lacks it", () => {
    const team = [
      { accountId: "a1", role: "Lead", primary: true },
      { accountId: "a2", role: " ", primary: false },
    ];

    expect(stepProblems(schemas, "team", { ...held, team })).toEqual({ team: { message: "role" } });
  });

  it("asks for exactly one primary contact once the roles are filled", () => {
    const none = [{ accountId: "a1", role: "Lead", primary: false }];
    const two = [
      { accountId: "a1", role: "Lead", primary: true },
      { accountId: "a2", role: "Dev", primary: true },
    ];

    expect(stepProblems(schemas, "team", { ...held, team: none })).toEqual({
      team: { message: "primary" },
    });
    expect(stepProblems(schemas, "team", { ...held, team: two })).toEqual({
      team: { message: "primary" },
    });
    expect(stepProblems(schemas, "team", { ...held, team: [] })).toBeUndefined();
  });

  it("asks for the PDF", () => {
    expect(stepProblems(schemas, "pdf", { ...held, deck: null })).toEqual({
      deck: { message: "deck" },
    });
  });
});
