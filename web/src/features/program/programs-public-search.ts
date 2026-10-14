import {
  createLoader,
  createSerializer,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import type { ProgramSummary } from "@/lib/api/generated";
import { pageSize } from "@/lib/page-size";

import { programTypes } from "./program-schemas";

/** The phases the public list is narrowed to, in the order its tabs show them. */
export const publicPhases = ["open", "upcoming", "done"] as const;

/** How many of its next events a program's card under Open now shows. */
export const openCardEvents = 3;

/** What narrows the public list of programs, as the URL holds it: `?phase=&type=`. */
export const programsPublicSearch = {
  q: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
  size: pageSize,
  sort: parseAsStringLiteral(["relevance", "newest", "name"] as const),
  phase: parseAsStringLiteral(publicPhases),
  type: parseAsStringLiteral(programTypes),
};

export const loadProgramsPublicSearch = createLoader(programsPublicSearch);
export const serializeProgramsPublicSearch = createSerializer(programsPublicSearch);

export type ProgramsPublicSearch = {
  q: string;
  page: number;
  size: number | null;
  sort: "relevance" | "newest" | "name" | null;
  phase: (typeof publicPhases)[number] | null;
  type: (typeof programTypes)[number] | null;
};

/** One entry of the list of what is open and coming up: a program, or an event to register for. */
export type Listing =
  | { kind: "program"; program: ProgramSummary }
  | { kind: "event"; program: ProgramSummary; event: ProgramSummary["upcomingEvents"][number] };

export type ProgramGroups = {
  /** What is open and coming up, programs and events together, by the day the reader acts on. */
  current: Listing[];
  done: ProgramSummary[];
  counts: Record<(typeof publicPhases)[number] | "all", number>;
};

/**
 * Whether a program is an event and nothing else, such as one read from Luma (BEY-190): it takes no
 * applications here, so it is listed by its events still to come, where people register, rather
 * than as a program.
 */
export function listedAsEvent(program: ProgramSummary) {
  return program.type === "event" && !program.applications && program.upcomingEvents.length > 0;
}

/**
 * The day a reader acts on: the deadline of a program taking applications, the day its applications
 * open or it starts for one to come, the next event or the end of one running, and an event's day.
 */
function actOn(listing: Listing) {
  if (listing.kind === "event") {
    return Date.parse(listing.event.startsAt);
  }
  const { program } = listing;
  const applications = program.applications;
  const day = (value: string | null | undefined) => (value ? Date.parse(value) : Infinity);
  if (program.phase === "open" && applications) return Date.parse(applications.closesAt);
  if (program.phase === "upcoming")
    return applications ? Date.parse(applications.opensAt) : day(program.startsOn);
  return Math.min(day(program.upcomingEvents[0]?.startsAt), day(program.endsOn));
}

/**
 * The programs the search selects, grouped as the page shows them, and how many programs are in
 * each phase of the selected type, for the tabs. Programs open now, running or coming up and the
 * events still to come are one list, each labelled program or event, by the day the reader acts on
 * (BEY-199): two lists counted two ways read as two different things. A program's own events stay on
 * its card; an event and nothing else is listed by each of its events.
 */
export function groupPrograms(
  programs: ProgramSummary[],
  search: ProgramsPublicSearch,
): ProgramGroups {
  const ofType = programs.filter((program) => !search.type || program.type === search.type);
  const shown = (phase: (typeof publicPhases)[number]) => !search.phase || search.phase === phase;
  const open = ofType.filter(
    (program) =>
      (program.phase === "open" || program.phase === "running") && !listedAsEvent(program),
  );
  const upcoming = ofType.filter(
    (program) => program.phase === "upcoming" && !listedAsEvent(program),
  );
  const asEvents = ofType.filter(listedAsEvent);
  const done = ofType.filter((program) => program.phase === "done" && !listedAsEvent(program));
  const current: Listing[] = [
    ...(shown("open") ? open : []).map((program) => ({ kind: "program" as const, program })),
    ...(shown("upcoming") ? upcoming : []).map((program) => ({
      kind: "program" as const,
      program,
    })),
    ...(shown("upcoming") ? asEvents : []).flatMap((program) =>
      program.upcomingEvents.map((event) => ({ kind: "event" as const, program, event })),
    ),
  ];
  return {
    current: current
      .map((listing) => ({ listing, at: actOn(listing) }))
      .sort((a, b) => a.at - b.at)
      .map(({ listing }) => listing),
    done: shown("done") ? done : [],
    counts: {
      open: open.length,
      upcoming: upcoming.length + asEvents.length,
      done: done.length,
      all: ofType.length,
    },
  };
}
