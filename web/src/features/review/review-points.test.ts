import { describe, expect, it } from "vitest";

import type { ReviewCriterion } from "@/lib/api/generated";

import { bandOf, maxTotal, scoreText } from "./review-points";

function criterion(maxPoints: number | null): ReviewCriterion {
  return { id: crypto.randomUUID(), name: "Impact", description: null, maxPoints };
}

describe("review points", () => {
  it("adds up the weights only when every criterion has them", () => {
    expect(maxTotal([criterion(20), criterion(5)])).toBe(25);
    expect(maxTotal([criterion(20), criterion(null)])).toBeNull();
    expect(maxTotal([])).toBeNull();
  });

  it("names the band a score falls in", () => {
    expect([1, 3, 4, 6, 7, 8, 9, 10].map(bandOf)).toEqual([
      "weak",
      "weak",
      "average",
      "average",
      "strong",
      "strong",
      "outstanding",
      "outstanding",
    ]);
  });

  it("reads a score in points out of the total, or as the mean of the scores", () => {
    expect(scoreText(62.5, 100)).toBe("62.5 / 100");
    expect(scoreText(64, 100)).toBe("64 / 100");
    expect(scoreText(7, null)).toBe("7.0");
  });
});
