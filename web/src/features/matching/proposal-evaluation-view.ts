import type { MatchingFinding, ProposalEvaluation } from "@/lib/api/generated";

import { sourceOf, type Source } from "./matching-view";

/**
 * Where a quote in a proposal comes from, read from the label the backend gives a source: what the
 * vendor wrote for the use case (its approach, its team, a page of its PDF), or one of the solutions
 * it offers, named, with that solution's own source and its label as a candidate's source has it.
 */
type ProposalSource =
  | { kind: "approach" }
  | { kind: "team" }
  | { kind: "proposalDeck"; page: number }
  | { kind: "solution"; name: string; source: Source; label: string };

/** The source a label names, with the name of the solution it belongs to; undefined for one this screen cannot name. */
export function proposalSourceOf(
  label: string,
  solutionNames: string[],
): ProposalSource | undefined {
  const text = label.trim().toLowerCase();
  if (text === "proposal") {
    return { kind: "approach" };
  }
  if (text === "team") {
    return { kind: "team" };
  }
  const deck = /^proposal deck p\.\s?(\d+)$/.exec(text);
  if (deck) {
    return { kind: "proposalDeck", page: Number(deck[1]) };
  }
  const solution = /^solution (\d+) (.+)$/.exec(text);
  if (!solution) {
    return undefined;
  }
  const name = solutionNames[Number(solution[1]) - 1];
  const source = sourceOf(solution[2]);
  return name && source ? { kind: "solution", name, source, label: solution[2] } : undefined;
}

/** What a proposal shows of one requirement; a proposal not read yet, or one without a finding, shows none. */
export function proposalFindingOf(
  evaluation: Pick<ProposalEvaluation, "findings"> | undefined,
  position: number,
): MatchingFinding | undefined {
  return evaluation?.findings.find((finding) => finding.requirement === position);
}
