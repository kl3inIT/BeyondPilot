import { describe, expect, it } from "vitest";

import { contrastWithWhite, READABLE_CONTRAST } from "./accent-contrast";

describe("contrastWithWhite", () => {
  it("runs from none on white to the most on black", () => {
    expect(contrastWithWhite("#FFFFFF")).toBeCloseTo(1, 5);
    expect(contrastWithWhite("#000000")).toBeCloseTo(21, 5);
  });

  it("finds white text readable on a deep blue and not on yellow", () => {
    expect(contrastWithWhite("#0B63C5")).toBeGreaterThan(READABLE_CONTRAST);
    expect(contrastWithWhite("#FFFF00")).toBeLessThan(READABLE_CONTRAST);
  });

  it("reads lower-case digits the same", () => {
    expect(contrastWithWhite("#0b63c5")).toBeCloseTo(contrastWithWhite("#0B63C5"), 10);
  });
});
