import { describe, expect, it } from "vitest";

import { budgetFigures } from "./use-case-budget";

describe("budgetFigures", () => {
  it("writes dollars in full", () => {
    expect(budgetFigures(25000, 40000, "USD", "en")).toEqual({
      currency: "USD",
      amounts: ["25,000", "40,000"],
    });
  });

  it("writes đồng in millions and billions", () => {
    expect(budgetFigures(150_000_000, 2_000_000_000, "VND", "en").amounts).toEqual(["150M", "2B"]);
    expect(budgetFigures(150_000_000, 300_000_000, "VND", "vi").amounts).toEqual([
      "150 triệu",
      "300 triệu",
    ]);
  });

  it("gives one amount when the range is a single figure", () => {
    expect(budgetFigures(200_000_000, 200_000_000, "VND", "en")).toEqual({
      currency: "VND",
      amounts: ["200M"],
    });
  });

  it("reads an unknown currency as dollars", () => {
    expect(budgetFigures(1000, 2000, undefined, "en").currency).toBe("USD");
  });
});
