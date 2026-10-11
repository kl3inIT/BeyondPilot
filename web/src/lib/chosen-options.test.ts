import { describe, expect, it } from "vitest";

import { answerOfChosen, chosenOptions } from "./chosen-options";

describe("chosenOptions", () => {
  it("reads the options an answer names, whatever they hold", () => {
    expect(chosenOptions('["Claims","Pricing, and underwriting"]')).toEqual([
      "Claims",
      "Pricing, and underwriting",
    ]);
    expect(chosenOptions(answerOfChosen(['Says "no"', "Fraud"]))).toEqual(['Says "no"', "Fraud"]);
  });

  it("reads no option from no answer and from an answer that is not a list", () => {
    expect(chosenOptions(undefined)).toEqual([]);
    expect(chosenOptions("")).toEqual([]);
    expect(chosenOptions("Claims")).toEqual([]);
    expect(chosenOptions('"Claims"')).toEqual([]);
  });
});

describe("answerOfChosen", () => {
  it("is no answer when nothing is chosen, so a required question is still unanswered", () => {
    expect(answerOfChosen([])).toBe("");
  });
});
