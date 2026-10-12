import { describe, expect, it } from "vitest";

import { eventSchema, slugify, slugPattern, type EventValue } from "./program-schemas";

describe("slugify", () => {
  it("makes the address the New program dialog suggests", () => {
    expect(slugify("AI for Insurance Challenge × Tasco")).toBe("ai-for-insurance-challenge-tasco");
    expect(slugify("  Agentic AI Build Week 2026  ")).toBe("agentic-ai-build-week-2026");
  });

  it("reads Vietnamese without its accents", () => {
    expect(slugify("Thử thách AI cho Bảo hiểm Đà Nẵng")).toBe("thu-thach-ai-cho-bao-hiem-da-nang");
  });

  it("stays an address the backend accepts", () => {
    const long = slugify(
      "The AI Workforce Shift · Beyond the Pilot · Executive Workshops for 2026 Leaders",
    );
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long).toMatch(slugPattern);
    expect(slugify("×××")).toBe("");
  });
});

describe("an event", () => {
  // The schema's words are the keys, so a test reads which rule spoke.
  const schema = eventSchema((key) => key);
  const event: EventValue = {
    title: "Briefing",
    startsDay: "2026-10-07",
    startsTime: "15:30",
    endsDay: "",
    endsTime: "",
    online: true,
    city: "",
    country: "",
    registrationUrl: "",
  };
  /** The problems of an event, as the field each stands under and the rule that found it. */
  const problems = (value: Partial<EventValue>) => {
    const result = schema.safeParse({ ...event, ...value });
    return result.success
      ? []
      : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  };

  it("needs its city when it is held in person, and none online", () => {
    expect(problems({})).toEqual([]);
    expect(problems({ online: false })).toEqual(["city: required"]);
    expect(problems({ online: false, city: "   " })).toEqual(["city: required"]);
    expect(problems({ online: false, city: "Hanoi" })).toEqual([]);
  });

  it("refuses half an end at the field that is missing, instead of dropping the end", () => {
    expect(problems({ endsDay: "2026-10-07" })).toEqual(["endsTime: endNeedsTime"]);
    expect(problems({ endsTime: "17:00" })).toEqual(["endsDay: endNeedsDay"]);
    expect(problems({ endsDay: "2026-10-07", endsTime: "17:00" })).toEqual([]);
    expect(problems({ endsDay: "2026-10-07", endsTime: "15:00" })).toEqual([
      "endsTime: endsBeforeStarts",
    ]);
  });
});
