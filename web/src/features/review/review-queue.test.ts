import { describe, expect, it } from "vitest";

import type { ReviewApplicationItem } from "@/lib/api/generated";

import { judgeQueue } from "./review-queue";

const item = (id: string, mine: ReviewApplicationItem["mine"], own = false) =>
  ({ id, mine, own }) as ReviewApplicationItem;

describe("judgeQueue", () => {
  const items = [
    item("a", "scored"),
    item("b", "none"),
    item("c", "scored"),
    item("d", "none"),
    item("e", "conflict"),
  ];

  it("counts what is left and skips what is scored or declared a conflict", () => {
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
    expect(judgeQueue([item("a", "scored"), item("b", "conflict")], "a")).toEqual({
      left: 0,
      nextId: null,
    });
  });

  it("never sends a judge to their own application", () => {
    expect(judgeQueue([item("a", "scored"), item("b", "none", true)], "a")).toEqual({
      left: 0,
      nextId: null,
    });
  });
});
