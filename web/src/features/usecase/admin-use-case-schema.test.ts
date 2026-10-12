import { describe, expect, it } from "vitest";

import { adminUseCaseSchema, editDaysOf } from "./admin-use-case-schema";

describe("editDaysOf", () => {
  it("takes whole days from 0 to 90", () => {
    expect(editDaysOf("0")).toBe(0);
    expect(editDaysOf(" 7 ")).toBe(7);
    expect(editDaysOf("90")).toBe(90);
  });

  it("refuses anything else", () => {
    for (const text of ["", "91", "-1", "1.5", "abc", "100", "07x"]) {
      expect(editDaysOf(text)).toBeNull();
    }
  });
});

describe("adminUseCaseSchema", () => {
  /** The rules with each key as its own words, so a test reads which rule spoke. */
  const schema = adminUseCaseSchema((key) => key);
  const held = {
    organizationId: "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c03",
    title: "Faster claims triage",
    problemStatement: "Claims handlers sort documents by hand.",
    industry: "insurance",
    technologies: ["document_intelligence"],
    expectedOutcomes: "Cut triage time by half.",
    currentProcess: "Every document is read by a person.",
    currentSolutions: "",
    targetUsers: "Claims operations.",
    requirements: [
      { statement: "Classify every document.", necessity: "required" },
      { statement: "", necessity: "required" },
      { statement: "  ", necessity: "optional" },
    ],
    dataReadiness: "Anonymized claims are ready.",
    integrationRequirements: "Connect to the claims API.",
    attachments: [],
    currency: "USD",
    budgetMin: "",
    budgetMax: "",
    budgetToBeDetermined: true,
    budgetMembersOnly: false,
    timeline: "4_8",
    proposalEditDays: "7",
    hideOrganizationName: false,
    closesDay: "2026-12-31",
    closesTime: "23:59",
  };
  const pathsOf = (value: unknown) =>
    schema.safeParse(value).error?.issues.map((issue) => issue.path.join(".")) ?? [];

  it("takes a use case whose spare requirement rows were left empty, as they are not sent", () => {
    expect(pathsOf(held)).toEqual([]);
  });

  it("asks for one requirement, on the first row, when every row is empty", () => {
    const none = held.requirements.map((row) => ({ ...row, statement: " " }));

    expect(pathsOf({ ...held, requirements: none })).toEqual(["requirements.0.statement"]);
    expect(pathsOf({ ...held, requirements: [] })).toEqual(["requirements.0.statement"]);
  });

  it("asks for both amounts in order unless the budget is to be determined", () => {
    const priced = { ...held, budgetToBeDetermined: false };

    expect(pathsOf(priced)).toEqual(["budgetMin", "budgetMax"]);
    expect(pathsOf({ ...priced, budgetMin: "40000", budgetMax: "15000" })).toEqual(["budgetMax"]);
    expect(pathsOf({ ...priced, budgetMin: "15000", budgetMax: "40000" })).toEqual([]);
  });
});
