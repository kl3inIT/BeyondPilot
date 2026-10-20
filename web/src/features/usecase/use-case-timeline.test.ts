import { describe, expect, it } from "vitest";

import { timelineText } from "./use-case-timeline";

const say = (key: string, values: Record<string, number>) => `${key} ${JSON.stringify(values)}`;

describe("timelineText", () => {
  it("writes equal weeks once", () => {
    expect(timelineText(13, 13, say)).toBe('single {"weeks":13}');
  });

  it("writes the form's open-ended choices as the form names them", () => {
    expect(timelineText(1, 4, say)).toBe('under {"weeks":4}');
    expect(timelineText(24, 52, say)).toBe('atLeast {"weeks":24}');
  });

  it("writes any other weeks as a range", () => {
    expect(timelineText(8, 12, say)).toBe('range {"min":8,"max":12}');
    expect(timelineText(8, 13, say)).toBe('range {"min":8,"max":13}');
  });
});
