import { describe, expect, it } from "vitest";

import { openingView } from "./matching-view-choice";

describe("the way the matched solutions open", () => {
  it("is one by one while a solution waits for a decision, for a person who never chose", () => {
    expect(openingView(null, true)).toBe("one");
  });

  it("is the list for a person who chose the list, whatever waits", () => {
    expect(openingView("list", true)).toBe("list");
    expect(openingView("list", false)).toBe("list");
  });

  it("is the list when nothing waits, even for a person who chose one by one", () => {
    expect(openingView(null, false)).toBe("list");
    expect(openingView("one", false)).toBe("list");
    expect(openingView("one", true)).toBe("one");
  });
});
