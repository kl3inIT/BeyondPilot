import { describe, expect, it } from "vitest";

import { bodyOf, incompleteSteps, timelineOf, type DraftValues } from "./use-case-draft";

const empty: DraftValues = {
  title: "",
  problemStatement: "",
  industry: "",
  technologies: [],
  expectedOutcomes: "",
  currentProcess: "",
  currentSolutions: "",
  targetUsers: "",
  requirements: [{ statement: "", necessity: "required" }],
  dataReadiness: "",
  integrationRequirements: "",
  attachments: [],
  budgetMin: "",
  budgetMax: "",
  budgetToBeDetermined: false,
  budgetMembersOnly: false,
  timelineMinWeeks: null,
  timelineMaxWeeks: null,
  closesDay: "",
  closesTime: "23:59",
  hideOrganizationName: false,
};

const complete: DraftValues = {
  ...empty,
  title: "AI vehicle ownership and document assistant",
  problemStatement: "Our service team checks documents by hand.",
  industry: "automotive_mobility",
  technologies: ["document_intelligence"],
  expectedOutcomes: "Cut hotline calls by 40%.",
  currentProcess: "Agents type dates into a spreadsheet.",
  targetUsers: "Vehicle owners.",
  requirements: [{ statement: "Read documents", necessity: "required" }],
  dataReadiness: "Scanned documents.",
  integrationRequirements: "App SDK.",
  budgetMin: "15000",
  budgetMax: "40000",
  timelineMinWeeks: 8,
  timelineMaxWeeks: 12,
  closesDay: "2026-12-31",
};

describe("bodyOf", () => {
  it("sends nothing written as null and leaves out an empty requirement", () => {
    const body = bodyOf(empty, 3);

    expect(body.title).toBeNull();
    expect(body.industry).toBeNull();
    expect(body.requirements).toEqual([]);
    expect(body.closesAt).toBeNull();
    expect(body.version).toBe(3);
  });

  it("sends the close date as the end of the day in Vietnam", () => {
    expect(bodyOf(complete, 0).closesAt).toBe("2026-12-31T16:59:00.000Z");
  });

  it("sends no amount while the budget is to be determined", () => {
    const body = bodyOf({ ...complete, budgetToBeDetermined: true }, 0);

    expect(body.budgetMin).toBeNull();
    expect(body.budgetMax).toBeNull();
    expect(body.budgetToBeDetermined).toBe(true);
  });

  it("sends an amount that is not a whole number as none", () => {
    expect(bodyOf({ ...complete, budgetMin: "1.5k" }, 0).budgetMin).toBeNull();
  });
});

describe("incompleteSteps", () => {
  it("names every step of an empty draft but the review", () => {
    expect(incompleteSteps(empty)).toEqual(["challenge", "outcomes", "requirements", "budget"]);
  });

  it("names none for a use case that holds everything", () => {
    expect(incompleteSteps(complete)).toEqual([]);
  });

  it("does not ask for the current solutions, which are optional", () => {
    expect(incompleteSteps({ ...complete, currentSolutions: "" })).toEqual([]);
  });

  it("asks for the amounts unless the budget is to be determined", () => {
    expect(incompleteSteps({ ...complete, budgetMax: "" })).toEqual(["budget"]);
    expect(
      incompleteSteps({ ...complete, budgetMin: "", budgetMax: "", budgetToBeDetermined: true }),
    ).toEqual([]);
  });
});

describe("timelineOf", () => {
  it("names the preset of the weeks, or none", () => {
    expect(timelineOf({ timelineMinWeeks: 8, timelineMaxWeeks: 12 })).toBe("8_12");
    expect(timelineOf({ timelineMinWeeks: 3, timelineMaxWeeks: 5 })).toBe("");
    expect(timelineOf({ timelineMinWeeks: null, timelineMaxWeeks: null })).toBe("");
  });
});
