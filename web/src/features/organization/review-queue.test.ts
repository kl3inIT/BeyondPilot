import { describe, expect, it } from "vitest";

import { nextWaiting } from "./review-queue";

describe("nextWaiting", () => {
  it("opens the one below the one decided", () => {
    expect(nextWaiting(["a", "b", "c"], ["a"])).toBe("b");
    expect(nextWaiting(["a", "b", "c"], ["b"])).toBe("c");
  });

  it("goes round to the top when nothing waits below", () => {
    expect(nextWaiting(["a", "b", "c"], ["c"])).toBe("a");
  });

  it("passes over what was decided earlier in the same sitting", () => {
    expect(nextWaiting(["a", "b", "c"], ["b", "a"])).toBe("c");
    expect(nextWaiting(["a", "b", "c"], ["a", "c"])).toBe("b");
  });

  it("answers null once every one was decided", () => {
    expect(nextWaiting(["a"], ["a"])).toBeNull();
    expect(nextWaiting(["a", "b"], ["a", "b"])).toBeNull();
    expect(nextWaiting([], ["a"])).toBeNull();
  });

  it("starts from the top when the one decided was not of the list", () => {
    expect(nextWaiting(["a", "b"], ["x"])).toBe("a");
  });
});
