import { describe, expect, it } from "vitest";

import { proposalStepSchemas, stepProblems } from "./proposal-schemas";

/** The rules with each key as its own words, so a test reads which rule spoke. */
const schemasFor = (organization: { team: boolean } | null) =>
  proposalStepSchemas((key) => key, { organization });
const schemas = schemasFor({ team: false });

const held = {
  who: "individual",
  teamName: "",
  teamBackground: "",
  solutionIds: ["s1"],
  approach: "It reads claims.",
  deck: { fileId: "f1", fileName: "deck.pdf", sizeBytes: 10 },
  details: { name: "Lan Tran", country: "VN", phone: "+84 912 345 678" },
  confirmed: false,
};

describe("stepProblems", () => {
  it("refuses nothing in a step that holds what it needs", () => {
    for (const step of ["you", "solutions", "review"]) {
      expect(stepProblems(schemas, step, held)).toBeUndefined();
    }
  });

  it("checks only the step asked about", () => {
    const empty = { ...held, solutionIds: [], approach: " ", deck: null };

    expect(stepProblems(schemas, "you", empty)).toBeUndefined();
    expect(stepProblems(schemas, "review", empty)).toBeUndefined();
  });

  it("asks for a solution, the approach and the PDF, each on its own field", () => {
    expect(
      stepProblems(schemas, "solutions", { ...held, solutionIds: [], approach: " ", deck: null }),
    ).toEqual({
      solutionIds: { message: "solution" },
      approach: { message: "approach" },
      deck: { message: "deck" },
    });
  });

  it("names the details by their place in the form", () => {
    expect(
      stepProblems(schemas, "you", { ...held, details: { name: " ", country: "", phone: "" } }),
    ).toEqual({
      "details.name": { message: "required" },
      "details.country": { message: "required" },
      "details.phone": { message: "required" },
    });
  });

  it("tells a number that is missing from one that cannot be a number", () => {
    const withPhone = (phone: string) => ({ ...held, details: { ...held.details, phone } });

    expect(stepProblems(schemas, "you", withPhone("call me"))).toEqual({
      "details.phone": { message: "phoneInvalid" },
    });
    expect(stepProblems(schemas, "you", withPhone(" 0912 345 678 "))).toBeUndefined();
  });

  it("requires joining or creating an organization before proceeding, not a deferred team choice", () => {
    const unorganized = schemasFor(null);
    expect(stepProblems(unorganized, "you", held)).toEqual({
      organization: { message: "company" },
    });
    expect(stepProblems(unorganized, "you", { ...held, teamBackground: "Built two." })).toEqual({
      organization: { message: "company" },
    });
  });

  it("asks the team an organization already is for what it has done, and nobody else", () => {
    expect(stepProblems(schemasFor({ team: true }), "you", held)).toEqual({
      teamBackground: { message: "background" },
    });
    expect(stepProblems(schemasFor({ team: false }), "you", held)).toBeUndefined();
  });
});
