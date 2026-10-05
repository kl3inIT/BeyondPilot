import { describe, expect, it } from "vitest";

import { slugify, slugPattern } from "./program-schemas";

describe("slugify", () => {
  it("makes the address the New program dialog suggests", () => {
    expect(slugify("AI for Insurance Challenge × Tasco")).toBe("ai-for-insurance-challenge-tasco");
    expect(slugify("  Agentic AI Build Week 2026  ")).toBe("agentic-ai-build-week-2026");
  });

  it("reads Vietnamese without its accents", () => {
    expect(slugify("Thử thách AI cho Bảo hiểm Đà Nẵng")).toBe("thu-thach-ai-cho-bao-hiem-da-nang");
  });

  it("stays an address the backend accepts", () => {
    const long = slugify(
      "The AI Workforce Shift · Beyond the Pilot · Executive Workshops for 2026 Leaders",
    );
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long).toMatch(slugPattern);
    expect(slugify("×××")).toBe("");
  });
});
