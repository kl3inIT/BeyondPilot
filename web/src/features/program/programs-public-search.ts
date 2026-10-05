import { createLoader, parseAsStringLiteral } from "nuqs/server";

import type { ProgramSummary } from "@/lib/api/generated";

import { programTypes } from "./program-schemas";

/** The phases the public list is narrowed to, in the order its tabs show them. */
export const publicPhases = ["open", "upcoming", "done"] as const;

/** What narrows the public list of programs, as the URL holds it: `?phase=&type=`. */
export const programsPublicSearch = {
  phase: parseAsStringLiteral(publicPhases),
  type: parseAsStringLiteral(programTypes),
};

export const loadProgramsPublicSearch = createLoader(programsPublicSearch);

export type ProgramsPublicSearch = Awaited<ReturnType<typeof loadProgramsPublicSearch>>;

/**
 * The programs the search selects, grouped as the page shows them, and how many programs are in
 * each phase of the selected type, for the tabs. A program still running after its applications
 * closed is shown under Open now.
 */
export function groupPrograms(programs: ProgramSummary[], search: ProgramsPublicSearch) {
  const ofType = programs.filter((program) => !search.type || program.type === search.type);
  const shown = (phase: (typeof publicPhases)[number]) => !search.phase || search.phase === phase;
  const open = ofType.filter((program) => program.phase === "open" || program.phase === "running");
  const upcoming = ofType.filter((program) => program.phase === "upcoming");
  const done = ofType.filter((program) => program.phase === "done");
  return {
    open: shown("open") ? open : [],
    upcoming: shown("upcoming") ? upcoming : [],
    // Coming up also lists the events still to come of programs that are open or running.
    events: shown("upcoming")
      ? open
          .flatMap((program) => program.upcomingEvents.map((event) => ({ program, event })))
          .sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt))
      : [],
    done: shown("done") ? done : [],
    counts: { open: open.length, upcoming: upcoming.length, done: done.length, all: ofType.length },
  };
}
