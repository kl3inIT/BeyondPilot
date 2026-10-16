import { describe, expect, it } from "vitest";

import type { ReviewCriterion } from "@/lib/api/generated";

import { levelPoints, maxTotal, scoreText } from "./review-points";

function criterion(maxPoints: number | null): ReviewCriterion {
  return { id: crypto.randomUUID(), name: "Impact", description: null, maxPoints };
}

describe("review points", () => {
  it("adds up the criteria only when every one is worth points", () => {
    expect(maxTotal([criterion(20), criterion(5)])).toBe(25);
    expect(maxTotal([criterion(20), criterion(null)])).toBeNull();
    expect(maxTotal([])).toBeNull();
  });

  it("gives each level its share of the criterion's points", () => {
    expect(levelPoints(4, 20)).toBe(16);
    expect(levelPoints(1, 5)).toBe(1);
  });

  it("reads a score in points out of the total, or as the mean of the levels", () => {
    expect(scoreText(62.5, 100)).toBe("62.5 / 100");
    expect(scoreText(64, 100)).toBe("64 / 100");
    expect(scoreText(4, null)).toBe("4.0");
  });
});
