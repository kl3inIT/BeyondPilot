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

export type ProgramGroups = {
  open: ProgramSummary[];
  upcoming: ProgramSummary[];
  done: ProgramSummary[];
  events: { program: ProgramSummary; event: ProgramSummary["upcomingEvents"][number] }[];
  counts: Record<(typeof publicPhases)[number] | "all", number>;
};

/**
 * The programs the search selects, grouped as the page shows them, and how many programs are in
 * each phase of the selected type, for the tabs. A program still running after its applications
 * closed is shown under Open now.
 */
export function groupPrograms(
  programs: ProgramSummary[],
  search: ProgramsPublicSearch,
): ProgramGroups {
  const ofType = programs.filter((program) => !search.type || program.type === search.type);
  const shown = (phase: (typeof publicPhases)[number]) => !search.phase || search.phase === phase;
  const open = ofType.filter((program) => program.phase === "open" || program.phase === "running");
  const upcoming = ofType.filter((program) => program.phase === "upcoming");
  const done = ofType.filter((program) => program.phase === "done");
  return {
    open: shown("open") ? open : [],
    upcoming: shown("upcoming") ? upcoming : [],
    // Coming up also lists the events still to come of programs that are open or running, except
    // those their card under Open now already shows.
    events: shown("upcoming")
      ? open
          .flatMap((program) =>
            program.upcomingEvents
              .slice(shown("open") ? openCardEvents : 0)
              .map((event) => ({ program, event })),
          )
          .sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt))
      : [],
    done: shown("done") ? done : [],
    counts: { open: open.length, upcoming: upcoming.length, done: done.length, all: ofType.length },
  };
}
