import { createLoader, parseAsString, parseAsStringLiteral } from "nuqs/server";

import type { AdminProgramSummary } from "@/lib/api/generated";
import { listSort, sortParam, type ListSort } from "@/lib/list-sort";

import { programState } from "./program-labels";

/** The states the operators' list is narrowed to, in the order its tabs show them. */
export const programStates = ["draft", "open", "upcoming", "running", "done"] as const;

/** The columns the list sorts by: the name, the state and the days it runs. */
const programSortKeys = ["program", "status", "runs"] as const;
type ProgramSortKey = (typeof programSortKeys)[number];

/**
 * The order when the URL names none, as the server reads the programs: by state, those taking
 * applications first, then those running, coming up and done.
 */
const defaultProgramSort: ListSort<ProgramSortKey> = { key: "status", desc: false };

/** The phases in the order the state sorts them: what needs the operators now comes first. */
const byUrgency: AdminProgramSummary["phase"][] = ["open", "running", "upcoming", "done"];

/**
 * What narrows the operators' list of programs, as the URL holds it: `?state=&q=&sort=`. The page
 * reads these on the server and the toolbar writes them. A value at its default is left out of the URL.
 */
export const programsSearch = {
  state: parseAsStringLiteral(programStates),
  q: parseAsString.withDefault(""),
  sort: parseAsString.withDefault(""),
};

export const loadProgramsSearch = createLoader(programsSearch);

export type ProgramsSearch = Awaited<ReturnType<typeof loadProgramsSearch>>;

/** A name as a search compares it: lowercase, without Vietnamese or other accents. */
function folded(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").toLowerCase();
}

/**
 * Compares two programs by one key. Programs without days to run come last either way; programs
 * that compare equal keep the order the server read them in.
 */
function compare(a: AdminProgramSummary, b: AdminProgramSummary, sort: ListSort<ProgramSortKey>) {
  const turn = sort.desc ? -1 : 1;
  switch (sort.key) {
    case "program":
      return turn * a.name.localeCompare(b.name);
    case "status":
      return turn * (byUrgency.indexOf(a.phase) - byUrgency.indexOf(b.phase));
    case "runs":
      if (!a.startsOn || !b.startsOn) {
        return a.startsOn ? -1 : b.startsOn ? 1 : 0;
      }
      return turn * a.startsOn.localeCompare(b.startsOn);
  }
}

/**
 * The programs the search selects in its order, and how many programs are in each state whatever
 * the search, for the tabs. GenAI Fund runs a few programs a year, so the whole list is read,
 * narrowed and sorted here.
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
  const sort = listSort(search.sort, programSortKeys, defaultProgramSort);
  return {
    items: [...items].sort((a, b) => compare(a, b, sort)),
    counts,
    total: programs.length,
    sortKeys: programSortKeys,
    defaultSort: sortParam(defaultProgramSort),
  };
}
