import { describe, expect, it } from "vitest";

import type { ProgramSummary } from "@/lib/api/generated";

import { groupPrograms, listedAsEvent, type ProgramsPublicSearch } from "./programs-public-search";

const all: ProgramsPublicSearch = {
  q: "",
  page: 1,
  size: null,
  sort: null,
  phase: null,
  type: null,
};

function event(title: string, startsAt: string) {
  return {
    title,
    startsAt,
    endsAt: null,
    online: false,
    city: "Ho Chi Minh City",
    country: "Vietnam",
    registrationUrl: "https://luma.com/x",
  };
}

function program(overrides: Partial<ProgramSummary>): ProgramSummary {
  return {
    slug: "a-program",
    name: "A program",
    type: "enterprise_challenge",
    partnerName: null,
    summary: null,
    coverFileId: null,
    phase: "upcoming",
    startsOn: "2026-11-01",
    endsOn: "2026-11-30",
    pageKind: "standard",
    externalUrl: null,
    applications: undefined,
    upcomingEvents: [],
    ...overrides,
  };
}

const dinner = program({
  slug: "gaf-tinyfish-vn",
  name: "TinyFish, Big Minds",
  type: "event",
  pageKind: "external",
  upcomingEvents: [event("TinyFish, Big Minds", "2026-10-26T11:00:00Z")],
});

const tasco = program({
  slug: "insurance-ai-tasco",
  phase: "open",
  applications: {
    opensAt: "2026-09-22T17:00:00Z",
    closesAt: "2026-10-15T16:59:00Z",
    shortlistSize: null,
    outcomesDueOn: null,
    allowUpdatesUntilClose: true,
    opensTitle: null,
    closesTitle: null,
    outcomesTitle: null,
  },
  upcomingEvents: [
    event("Briefing", "2026-10-16T02:00:00Z"),
    event("Clinic", "2026-10-20T02:00:00Z"),
    event("Pitch rehearsal", "2026-10-21T02:00:00Z"),
    event("Demo day", "2026-10-22T02:00:00Z"),
  ],
});

const meetup = program({ slug: "genai-builders-hanoi", type: "event_series" });

describe("groupPrograms", () => {
  it("lists programs and events together, each by the day the reader acts on", () => {
    const groups = groupPrograms([dinner, tasco, meetup], all);

    // Tasco closes on 15 October, the dinner is on 26 October, the meetup starts on 1 November.
    expect(
      groups.current.map((listing) =>
        listing.kind === "event"
          ? `event ${listing.event.title}`
          : `program ${listing.program.slug}`,
      ),
    ).toEqual([
      "program insurance-ai-tasco",
      "event TinyFish, Big Minds",
      "program genai-builders-hanoi",
    ]);
    expect(groups.counts).toEqual({ open: 1, upcoming: 2, done: 0, all: 3 });
  });

  it("keeps a program's own events on its card, not as entries of the list", () => {
    expect(groupPrograms([tasco], all).current).toEqual([{ kind: "program", program: tasco }]);
  });

  it("keeps an event without an event still to come, or one taking applications, as a program", () => {
    expect(listedAsEvent(program({ type: "event" }))).toBe(false);
    expect(listedAsEvent({ ...dinner, applications: tasco.applications })).toBe(false);
    expect(listedAsEvent(dinner)).toBe(true);
  });

  it("lists the dinner under Coming up alone, not under Open now or Done", () => {
    expect(groupPrograms([dinner], { ...all, phase: "upcoming" }).current).toHaveLength(1);
    expect(groupPrograms([dinner, tasco], { ...all, phase: "open" }).current).toEqual([
      { kind: "program", program: tasco },
    ]);
    expect(groupPrograms([dinner], { ...all, phase: "done" }).done).toHaveLength(0);
  });

  it("lists what ended last first under Done, an undated program last", () => {
    const ended = (slug: string, endsOn: string | null) => program({ slug, phase: "done", endsOn });
    const done = groupPrograms(
      [
        ended("apr-27", "2026-04-27"),
        ended("undated", null),
        ended("apr-21", "2026-04-21"),
        ended("sep-17", "2026-09-17"),
        ended("oct-2025", "2025-10-21"),
      ],
      all,
    ).done;
    expect(done.map((p) => p.slug)).toEqual(["sep-17", "apr-27", "apr-21", "oct-2025", "undated"]);
  });
});
