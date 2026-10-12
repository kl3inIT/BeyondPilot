import { describe, expect, it } from "vitest";

import { moved } from "./program-question-order";

describe("moved, a row of an ordered list taken up or down", () => {
  const rows = ["a", "b", "c"];

  it("takes a row one place down or up", () => {
    expect(moved(rows, 0, 1)).toEqual(["b", "a", "c"]);
    expect(moved(rows, 2, -1)).toEqual(["a", "c", "b"]);
  });

  it("moves the same row on when it is moved again from where it landed", () => {
    expect(moved(moved(rows, 0, 1), 1, 1)).toEqual(["b", "c", "a"]);
  });

  it("stops at either end of the list", () => {
    expect(moved(rows, 0, -1)).toEqual(rows);
    expect(moved(rows, 2, 1)).toEqual(rows);
  });

  it("leaves the rows it was given as they were", () => {
    moved(rows, 0, 1);

    expect(rows).toEqual(["a", "b", "c"]);
  });
});
