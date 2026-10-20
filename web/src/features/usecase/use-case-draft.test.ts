import { describe, expect, it } from "vitest";

import {
  bodyOf,
  draftSchema,
  fieldNameOf,
  incompleteSteps,
  timelineOf,
  type DraftValues,
} from "./use-case-draft";

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
  currency: "USD",
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

describe("draftSchema", () => {
  const say = {
    tooLong: (max: number) => `max ${max}`,
    wholeAmount: "whole",
    budgetOutOfOrder: "order",
    closesInPast: "past",
  };
  // 20 October 2026, 10:00 in Vietnam.
  const schema = draftSchema(say, () => Date.parse("2026-10-20T03:00:00Z"));
  const issues = (values: Partial<DraftValues>) =>
    (schema.safeParse({ ...empty, ...values }).error?.issues ?? []).map((issue) => [
      issue.path.join("."),
      issue.message,
    ]);

  it("lets an empty draft through", () => {
    expect(issues({})).toEqual([]);
  });

  it("refuses text past its limit", () => {
    expect(issues({ title: "x".repeat(201), problemStatement: "x".repeat(2001) })).toEqual([
      ["title", "max 200"],
      ["problemStatement", "max 2000"],
    ]);
  });

  it("refuses an amount below 0 or not whole, and a maximum below the minimum", () => {
    expect(issues({ budgetMin: "-5", budgetMax: "1.5" })).toEqual([
      ["budgetMin", "whole"],
      ["budgetMax", "whole"],
    ]);
    expect(issues({ budgetMin: "100", budgetMax: "50" })).toEqual([["budgetMax", "order"]]);
    expect(issues({ budgetMin: "100", budgetMax: "50", budgetToBeDetermined: true })).toEqual([]);
  });

  it("refuses a close time already gone in Vietnam", () => {
    expect(issues({ closesDay: "2026-10-20", closesTime: "09:59" })).toEqual([
      ["closesDay", "past"],
    ]);
    expect(issues({ closesDay: "2026-10-20", closesTime: "10:01" })).toEqual([]);
  });

  it("refuses a thirty-first requirement", () => {
    const row = { statement: "Reads invoices", necessity: "required" as const };
    expect(issues({ requirements: Array(30).fill(row) })).toEqual([]);
    expect(issues({ requirements: Array(31).fill(row) })).toEqual([["requirements", "max 30"]]);
  });
});

describe("fieldNameOf", () => {
  it("names a field as the form does", () => {
    expect(fieldNameOf(["title"])).toBe("title");
    expect(fieldNameOf(["requirements", 3, "statement"])).toBe("requirements[3].statement");
  });
});
