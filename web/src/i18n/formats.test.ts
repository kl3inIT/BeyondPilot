import { describe, expect, it } from "vitest";

import { clockText, deadlineText, formatterOf, momentText } from "./formats";

// 22 Oct 2026, 23:59:07 in Vietnam, still 16:59 in UTC: the zone of the machine must not show.
const at = new Date("2026-10-22T16:59:07Z");

describe("times of day", () => {
  it("writes a time in Vietnam time with its zone, whoever reads it", () => {
    const format = formatterOf("en");

    expect(clockText(format, at)).toBe("23:59 ICT");
    expect(clockText(format, at, "seconds")).toBe("23:59:07 ICT");
    expect(momentText(format, at)).toBe("22 Oct 2026, 23:59 ICT");
    expect(momentText(format, at, "day")).toBe("22 Oct, 23:59 ICT");
    expect(deadlineText(format, at)).toBe("22 Oct, 23:59 ICT");
  });

  it("writes a span within a day with the zone once", () => {
    const starts = new Date("2026-10-07T08:30:00Z");
    const until = new Date("2026-10-07T10:00:00Z");

    expect(momentText(formatterOf("en"), starts, "day", { until })).toBe("7 Oct, 15:30–17:00 ICT");
  });

  it("puts the day before the time in Vietnamese too", () => {
    expect(momentText(formatterOf("vi"), at)).toMatch(/^22 thg 10, 2026, 23:59 ICT$/);
  });
});
