import { describe, expect, it } from "vitest";

import {
  fillOutcome,
  outcomeLink,
  outcomeParts,
  unknownPlaceholders,
} from "./outcome-placeholders";

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

describe("outcomeParts", () => {
  const names = { organization: "[win](https://evil.example)", solution: "https://evil.example" };

  it("reads the links the operator wrote, and an address on its own, as the email does", () => {
    expect(
      outcomeParts(
        "Read the [brief](https://docs.example/b?a=1) or https://zoom.example/j/1.",
        names,
      ),
    ).toEqual([
      { text: "Read the " },
      { text: "brief", href: "https://docs.example/b?a=1" },
      { text: " or " },
      { text: "https://zoom.example/j/1", href: "https://zoom.example/j/1" },
      { text: "." },
    ]);
  });

  it("never makes a link of a name, nor of an address that is not the web", () => {
    expect(outcomeParts("Hi {organization}, {solution}. [x](javascript:alert(1))", names)).toEqual([
      {
        text: "Hi [win](https://evil.example), https://evil.example. [x](javascript:alert(1))",
      },
    ]);
  });
});

describe("outcomeLink", () => {
  it("writes the words with their address, adding https when it is left out", () => {
    expect(outcomeLink("Demo Day brief", "docs.example/brief")).toBe(
      "[Demo Day brief](https://docs.example/brief)",
    );
  });

  it("writes the address alone when there are no words", () => {
    expect(outcomeLink("  ", "https://zoom.example/j/1")).toBe("https://zoom.example/j/1");
  });
});
