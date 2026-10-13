import { describe, expect, it } from "vitest";

import { openingView } from "./matching-view-choice";

describe("the way the matched solutions open", () => {
  it("is one by one while a solution waits for a decision, for a person who never chose", () => {
    expect(openingView(null, true, false)).toBe("one");
  });

  it("is the list for a person who chose the list, whatever waits", () => {
    expect(openingView("list", true, false)).toBe("list");
    expect(openingView("list", false, false)).toBe("list");
  });

  it("is the list when nothing waits, even for a person who chose one by one", () => {
    expect(openingView(null, false, false)).toBe("list");
    expect(openingView("one", false, false)).toBe("list");
    expect(openingView("one", true, false)).toBe("one");
  });

  it("is the list when the address asks for one solution, which the list reads in full", () => {
    expect(openingView(null, true, true)).toBe("list");
    expect(openingView("one", true, true)).toBe("list");
  });
});
