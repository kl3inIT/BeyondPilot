import { describe, expect, it } from "vitest";

import { fillOutcome, unknownPlaceholders } from "./outcome-placeholders";

describe("fillOutcome", () => {
  it("fills every placeholder with the applicant's names", () => {
    expect(
      fillOutcome("Hi {organization}, {solution} is shortlisted. {organization} hears more soon.", {
        organization: "Pocket Policy",
        solution: "Claim Copilot",
      }),
    ).toBe("Hi Pocket Policy, Claim Copilot is shortlisted. Pocket Policy hears more soon.");
  });

  it("leaves what is not a placeholder as typed, as the backend does", () => {
    expect(fillOutcome("Hi {organisation}", { organization: "A", solution: "B" })).toBe(
      "Hi {organisation}",
    );
  });
});

describe("unknownPlaceholders", () => {
  it("names each misspelt placeholder once, across the subject and the message", () => {
    expect(
      unknownPlaceholders("For {Solution}", "Hi {organisation},\n{organisation} and {solution}"),
    ).toEqual(["{Solution}", "{organisation}"]);
  });

  it("finds nothing in an email that uses only the two placeholders", () => {
    expect(unknownPlaceholders("{organization}", "{solution} for {organization}")).toEqual([]);
  });

  it("does not take a brace left open, or one across lines, for a placeholder", () => {
    expect(unknownPlaceholders("a { b", "c {\n} d")).toEqual([]);
  });
});
