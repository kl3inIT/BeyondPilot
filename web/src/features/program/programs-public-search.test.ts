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
  it("lists an event and nothing else by its events, apart from the programs, soonest first", () => {
    const groups = groupPrograms([dinner, tasco, meetup], all);

    expect(groups.open.map((p) => p.slug)).toEqual(["insurance-ai-tasco"]);
    expect(groups.upcoming.map((p) => p.slug)).toEqual(["genai-builders-hanoi"]);
    // Tasco's card shows its first three events; the fourth and the dinner are listed by date.
    expect(groups.events.map(({ event }) => event.title)).toEqual([
      "Demo day",
      "TinyFish, Big Minds",
    ]);
    expect(groups.counts).toEqual({ open: 1, upcoming: 2, done: 0, all: 3 });
  });

  it("keeps an event without an event still to come, or one taking applications, as a program", () => {
    expect(listedAsEvent(program({ type: "event" }))).toBe(false);
    expect(listedAsEvent({ ...dinner, applications: tasco.applications })).toBe(false);
    expect(listedAsEvent(dinner)).toBe(true);
  });

  it("lists the dinner under Coming up alone, not under Open now or Done", () => {
    expect(groupPrograms([dinner], { ...all, phase: "upcoming" }).events).toHaveLength(1);
    expect(groupPrograms([dinner], { ...all, phase: "open" }).events).toHaveLength(0);
    expect(groupPrograms([dinner], { ...all, phase: "done" }).done).toHaveLength(0);
  });
});
