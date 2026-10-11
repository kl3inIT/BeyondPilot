import { describe, expect, it } from "vitest";

import { yearOf } from "./organization-format";

describe("yearOf", () => {
  it("takes a four-digit year from 1800 to this year", () => {
    expect(yearOf("1800", 2026)).toBe(1800);
    expect(yearOf(" 2026 ", 2026)).toBe(2026);
  });

  it("refuses a year that has not come, one before 1800 and anything that is not a year", () => {
    expect(yearOf("2027", 2026)).toBeNull();
    expect(yearOf("1799", 2026)).toBeNull();
    expect(yearOf("21", 2026)).toBeNull();
    expect(yearOf("", 2026)).toBeNull();
  });
});
