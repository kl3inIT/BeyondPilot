import { describe, expect, it } from "vitest";

import { calendarFile } from "./event-calendar";

function contentOf(href: string) {
  return decodeURIComponent(href.replace("data:text/calendar;charset=utf-8,", ""));
}

describe("calendarFile", () => {
  it("holds the event's name, times in UTC and place, escaped as calendars read them", () => {
    const file = calendarFile({
      name: "GenAI Builders Meetup; Singapore, ft. Twilio",
      startsAt: new Date("2026-11-19T10:00:00Z"),
      endsAt: new Date("2026-11-19T12:00:00Z"),
      place: "Singapore",
      slug: "genai-builders-meetup",
    });
    expect(file.fileName).toBe("genai-builders-meetup.ics");
    const lines = contentOf(file.href).split("\r\n");
    expect(lines).toContain("DTSTART:20261119T100000Z");
    expect(lines).toContain("DTEND:20261119T120000Z");
    expect(lines).toContain("SUMMARY:GenAI Builders Meetup\\; Singapore\\, ft. Twilio");
    expect(lines).toContain("LOCATION:Singapore");
    expect(lines).toContain("UID:genai-builders-meetup@beyondpilot.ai");
  });

  it("gives an event without an end an hour and leaves out a place it does not know", () => {
    const lines = contentOf(
      calendarFile({
        name: "Office hours",
        startsAt: new Date("2026-11-19T10:00:00Z"),
        endsAt: null,
        place: null,
        slug: "office-hours",
      }).href,
    ).split("\r\n");
    expect(lines).toContain("DTEND:20261119T110000Z");
    expect(lines.some((line) => line.startsWith("LOCATION"))).toBe(false);
  });
});
