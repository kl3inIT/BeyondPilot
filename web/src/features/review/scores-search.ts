import { createLoader, parseAsString, parseAsStringLiteral } from "nuqs/server";

import type { ProgramScorer, ProgramScores, ProgramScoresRow } from "@/lib/api/generated";
import { listSort, sortParam, type ListSort } from "@/lib/list-sort";

import { folded } from "./review-search";

/** What the Scores tab compares: the applications, each scorer a column, or the scorers themselves. */
export const scoresViews = ["applications", "judges"] as const;

/** What narrows the Scores tab, as the URL holds it: `?view=&q=&sort=`. */
export const scoresSearch = {
  view: parseAsStringLiteral(scoresViews).withDefault("applications"),
  q: parseAsString.withDefault(""),
  sort: parseAsString.withDefault(""),
};

export const loadScoresSearch = createLoader(scoresSearch);

export type ScoresSearch = Awaited<ReturnType<typeof loadScoresSearch>>;

/** The column and sort key of a scorer: `s:` and their account. */
export function scorerKey(accountId: string) {
  return `s:${accountId}`;
}

/** One scorer's work over the applications the search keeps, as By judge lists it. */
export type ScorerSummary = {
  scorer: ProgramScorer;
  scored: number;
  conflicts: number;
  /** The applications a judge has neither scored nor stepped back from; none for GenAI Fund. */
  waiting: number | null;
  /** The mean of their scores, one decimal; null until they score one. */
  mean: number | null;
};

/** The number a row sorts by; null sorts last either way. */
function valueOf(row: ProgramScoresRow, key: string): number | null {
  switch (key) {
    case "average":
      return row.average ?? null;
    case "scored":
      return row.scored;
    case "spread":
      return row.spread ?? null;
    default:
      return row.scores.find((cell) => scorerKey(cell.accountId) === key)?.score ?? null;
  }
}

function compare(a: ProgramScoresRow, b: ProgramScoresRow, sort: ListSort<string>) {
  const turn = sort.desc ? -1 : 1;
  if (sort.key === "applicant") {
    return turn * a.solution.localeCompare(b.solution);
  }
  const first = valueOf(a, sort.key);
  const second = valueOf(b, sort.key);
  if (first == null || second == null) {
    return first == null ? (second == null ? 0 : 1) : -1;
  }
  return turn * (first - second);
}

/**
 * The shortlisted applications the search keeps, in its order, and each scorer's work over them.
 * Judges score only the shortlist (BEY-213), so nothing else is compared: at Tasco on 22 October
 * every one of the 45 scores was on a shortlisted application. The highest mean comes first unless
 * the URL names another order; applications that compare equal keep the order they were submitted
 * in.
 */
export function scoresTable(data: ProgramScores, search: ScoresSearch) {
  const text = folded(search.q.trim());
  const shortlist = data.applications.filter((row) => row.reviewStatus === "shortlisted");
  const shown = shortlist.filter(
    (row) =>
      !text || folded(row.solution).includes(text) || folded(row.organization).includes(text),
  );
  // Every judge, and GenAI Fund's people who scored the shortlist: an operator who scored only
  // applications left out would be a column of dashes.
  const scorers = data.scorers.filter(
    (scorer) =>
      scorer.role === "reviewer" ||
      shortlist.some((row) => row.scores.some((cell) => cell.accountId === scorer.accountId)),
  );
  const keys = [
    "applicant",
    "average",
    "spread",
    "scored",
    ...scorers.map((scorer) => scorerKey(scorer.accountId)),
  ];
  const fallback = { key: "average", desc: true };
  const sort = listSort(search.sort, keys, fallback);
  const order = new Map(data.applications.map((row, index) => [row.id, index]));
  const rows = [...shown].sort(
    (a, b) => compare(a, b, sort) || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
  );
  const judges: ScorerSummary[] = scorers.map((scorer) => {
    const cells = shown.flatMap((row) =>
      row.scores.filter((cell) => cell.accountId === scorer.accountId),
    );
    const scores = cells.flatMap((cell) => (cell.score == null ? [] : [cell.score]));
    return {
      scorer,
      scored: scores.length,
      conflicts: cells.filter((cell) => cell.conflict).length,
      waiting:
        scorer.role === "reviewer"
          ? shown.filter((row) => !row.scores.some((cell) => cell.accountId === scorer.accountId))
              .length
          : null,
      mean:
        scores.length === 0
          ? null
          : Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10,
    };
  });
  return {
    rows,
    scorers,
    shortlisted: shortlist.length,
    judges,
    sortKeys: keys,
    defaultSort: sortParam(fallback),
    // Judges this far apart on one application are worth talking over: 2 points on the 1 to 10 scale.
    wide: data.scale / 5,
  };
}
