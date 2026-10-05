import { createLoader, parseAsString, parseAsStringLiteral } from "nuqs/server";

import type { AdminProgramSummary } from "@/lib/api/generated";

import { programState } from "./program-labels";

/** The states the operators' list is narrowed to, in the order its tabs show them. */
export const programStates = ["draft", "open", "upcoming", "running", "done"] as const;

/**
 * What narrows the operators' list of programs, as the URL holds it: `?state=&q=`. The page reads
 * these on the server and the toolbar writes them. A value at its default is left out of the URL.
 */
export const programsSearch = {
  state: parseAsStringLiteral(programStates),
  q: parseAsString.withDefault(""),
};

export const loadProgramsSearch = createLoader(programsSearch);

export type ProgramsSearch = Awaited<ReturnType<typeof loadProgramsSearch>>;

/** A name as a search compares it: lowercase, without Vietnamese or other accents. */
function folded(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").toLowerCase();
}

/**
 * The programs the search selects, and how many programs are in each state whatever the search, for
 * the tabs. GenAI Fund runs a few programs a year, so the whole list is read and narrowed here.
 */
export function narrowPrograms(programs: AdminProgramSummary[], search: ProgramsSearch) {
  const counts = Object.fromEntries(programStates.map((state) => [state, 0])) as Record<
    (typeof programStates)[number],
    number
  >;
  for (const program of programs) {
    counts[programState(program).key] += 1;
  }
  const text = folded(search.q.trim());
  const items = programs.filter(
    (program) =>
      (!search.state || programState(program).key === search.state) &&
      (!text || folded(program.name).includes(text) || program.slug.includes(text)),
  );
  return { items, counts, total: programs.length };
}
