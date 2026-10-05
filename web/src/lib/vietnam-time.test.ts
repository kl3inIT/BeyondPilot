import { describe, expect, it } from "vitest";

import { instantInVietnam, partsInVietnam } from "./vietnam-time";

describe("Vietnam time", () => {
  it("reads a deadline of 23:59 on 15 October as the instant it is in Vietnam", () => {
    expect(instantInVietnam("2026-10-15", "23:59")).toBe("2026-10-15T16:59:00.000Z");
    expect(instantInVietnam("2026-09-23", "00:00")).toBe("2026-09-22T17:00:00.000Z");
  });

  it("writes an instant back as the day and the time in Vietnam", () => {
    expect(partsInVietnam("2026-10-15T16:59:00Z")).toEqual({ day: "2026-10-15", time: "23:59" });
    expect(partsInVietnam("2026-09-22T17:00:00Z")).toEqual({ day: "2026-09-23", time: "00:00" });
  });
});
