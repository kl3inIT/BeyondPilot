import { describe, expect, it } from "vitest";

import { scrollEdges } from "./table-scroll-edges";

describe("scrollEdges", () => {
  it("hides nothing when the table fits", () => {
    expect(scrollEdges(0, 720, 720)).toEqual({ start: false, end: false });
  });

  it("hides its end before it is scrolled, both sides midway, its start at the end", () => {
    expect(scrollEdges(0, 358, 720)).toEqual({ start: false, end: true });
    expect(scrollEdges(120, 358, 720)).toEqual({ start: true, end: true });
    expect(scrollEdges(362, 358, 720)).toEqual({ start: true, end: false });
  });

  it("takes a fraction of a pixel for the edge", () => {
    expect(scrollEdges(0.4, 358, 358.6)).toEqual({ start: false, end: false });
    expect(scrollEdges(361.5, 358, 720)).toEqual({ start: true, end: false });
  });
});
