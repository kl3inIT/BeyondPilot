import { describe, expect, it } from "vitest";

import { editDaysOf } from "./admin-use-case-schema";

describe("editDaysOf", () => {
  it("takes whole days from 0 to 90", () => {
    expect(editDaysOf("0")).toBe(0);
    expect(editDaysOf(" 7 ")).toBe(7);
    expect(editDaysOf("90")).toBe(90);
  });

  it("refuses anything else", () => {
    for (const text of ["", "91", "-1", "1.5", "abc", "100", "07x"]) {
      expect(editDaysOf(text)).toBeNull();
    }
  });
});
