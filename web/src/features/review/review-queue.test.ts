import { describe, expect, it } from "vitest";

import type { ReviewApplicationItem } from "@/lib/api/generated";

import { judgeQueue } from "./review-queue";

const item = (id: string, mine: ReviewApplicationItem["mine"], own = false, shortlisted = false) =>
  ({ id, mine, own, shortlisted }) as ReviewApplicationItem;

describe("judgeQueue", () => {
  const items = [
    item("a", "scored"),
    item("b", "none"),
    item("c", "scored"),
    item("d", "none"),
    item("e", "scored"),
  ];

  it("counts what is left and skips what is scored", () => {
    expect(judgeQueue(items, "a")).toEqual({ left: 2, nextId: "b" });
    expect(judgeQueue(items, "b")).toEqual({ left: 2, nextId: "d" });
  });

  it("goes round to the start of the list for one that was passed over", () => {
    expect(judgeQueue(items, "d")).toEqual({ left: 2, nextId: "b" });
    expect(judgeQueue(items, "e")).toEqual({ left: 2, nextId: "b" });
  });

  it("has nothing next when the one on show is the last one left, or none is", () => {
    expect(judgeQueue([item("a", "scored"), item("b", "none")], "b")).toEqual({
      left: 1,
      nextId: null,
    });
    expect(judgeQueue([item("a", "scored"), item("b", "scored")], "a")).toEqual({
      left: 0,
      nextId: null,
    });
  });

  it("once the outcomes are released, leaves only the shortlisted to score", () => {
    const released = [item("a", "none"), item("b", "none", false, true), item("c", "none")];
    expect(judgeQueue(released, "a", true)).toEqual({ left: 1, nextId: "b" });
    expect(judgeQueue(released, "a")).toEqual({ left: 3, nextId: "b" });
  });

  it("never sends a judge to their own application", () => {
    expect(judgeQueue([item("a", "scored"), item("b", "none", true)], "a")).toEqual({
      left: 0,
      nextId: null,
    });
  });
});
