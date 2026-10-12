import { describe, expect, it } from "vitest";

import { programStanding } from "./program-labels";

// A program that takes applications from 1 to 15 October and runs until 5 December, in Vietnam.
const program = {
  startsOn: "2026-10-01",
  endsOn: "2026-12-05",
  applications: {
    opensAt: "2026-10-01T02:00:00.000Z",
    closesAt: "2026-10-15T16:59:00.000Z",
    outcomesDueOn: "2026-10-20",
  },
};

/** Where the program stands at a moment, with the day that moment is in Vietnam. */
function at(instant: string, of: Parameters<typeof programStanding>[0] = program) {
  const now = Date.parse(instant);
  const today = new Date(now + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return programStanding(of, now, today);
}

describe("programStanding, where a program is and what it waits for", () => {
  it("is coming up until its applications open, and waits for that", () => {
    expect(at("2026-09-30T10:00:00Z")).toEqual({
      phase: "upcoming",
      next: { kind: "opens", at: program.applications.opensAt },
    });
  });

  it("is open from the opening to the minute before the close, and waits for the close", () => {
    const closes = { kind: "closes", at: program.applications.closesAt };

    expect(at(program.applications.opensAt)).toEqual({ phase: "open", next: closes });
    expect(at("2026-10-15T16:58:59Z")).toEqual({ phase: "open", next: closes });
  });

  it("is running once applications close, and waits for the outcomes, then for its last day", () => {
    expect(at(program.applications.closesAt)).toEqual({
      phase: "running",
      next: { kind: "outcomes", day: "2026-10-20" },
    });
    // The day the outcomes are due is still ahead until it is over, in Vietnam.
    expect(at("2026-10-20T16:59:00Z").next).toEqual({ kind: "outcomes", day: "2026-10-20" });
    expect(at("2026-10-20T17:00:00Z").next).toEqual({ kind: "ends", day: "2026-12-05" });
  });

  it("is done the day after its last day, in Vietnam", () => {
    expect(at("2026-12-05T16:59:00Z").phase).toBe("running");
    expect(at("2026-12-05T17:00:00Z")).toEqual({
      phase: "done",
      next: { kind: "ended", day: "2026-12-05" },
    });
  });

  it("reads a program that takes no applications here from its days alone", () => {
    const meetup = { startsOn: "2026-11-02", endsOn: "2026-11-02" };

    expect(at("2026-11-01T10:00:00Z", meetup)).toEqual({
      phase: "upcoming",
      next: { kind: "starts", day: "2026-11-02" },
    });
    expect(at("2026-11-02T03:00:00Z", meetup)).toEqual({
      phase: "running",
      next: { kind: "ends", day: "2026-11-02" },
    });
  });

  it("waits for nothing when it has no day to wait for", () => {
    expect(at("2026-11-02T03:00:00Z", {})).toEqual({ phase: "running", next: null });
  });
});
