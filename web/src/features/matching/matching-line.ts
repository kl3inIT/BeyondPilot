import type { MatchingCandidate } from "@/lib/api/generated";

import { findingOf, grouped, openingOf, type Need } from "./matching-view";

/** What a person did to the card in front, as the one-by-one review takes it back. */
export type Step = { id: string; kind: "shortlisted" | "removed" | "later" };

type Reviewed = Pick<MatchingCandidate, "id" | "judged" | "bucket" | "decision">;

/** Whether a candidate waits for a decision: a run read it, put it in a group, and nobody decided on it. */
export function reviewable(candidate: Reviewed) {
  return candidate.judged && candidate.bucket !== "none" && candidate.decision === "none";
}

/** The candidates that wait for a decision, in the order of the list: by group, strongest first. */
export function listOrder(candidates: MatchingCandidate[]): string[] {
  const sections = grouped(candidates.filter(reviewable));
  return [...sections.direct, ...sections.industry, ...sections.technology].map((one) => one.id);
}

/**
 * The line of cards. The card in front stays in front for as long as its candidate exists and the person
 * has not decided on it here, even when someone else decided on it meanwhile, so that it never changes
 * under the reader. Then come the candidates of the line as the person left it that still wait, and last
 * the ones that started to wait since, in the order of the list: a solution a run has just read joins the
 * end. What the person sent away (`gone`) is not in the line until it comes back by Undo.
 */
export function lineOf(
  order: readonly string[],
  candidates: MatchingCandidate[],
  gone: ReadonlySet<string>,
  front: string | null,
): MatchingCandidate[] {
  const byId = new Map(candidates.map((one) => [one.id, one]));
  const waits = (id: string) => {
    const one = byId.get(id);
    return one !== undefined && reviewable(one) && !gone.has(id);
  };
  const first = front !== null && byId.has(front) && !gone.has(front) ? [front] : [];
  const kept = order.filter((id) => waits(id) && !first.includes(id));
  const placed = new Set([...first, ...kept]);
  const added = listOrder(candidates).filter((id) => waits(id) && !placed.has(id));
  return [...first, ...kept, ...added].map((id) => byId.get(id) as MatchingCandidate);
}

/** The line with one card moved behind every other. */
export function toEnd(line: readonly string[], id: string): string[] {
  return [...line.filter((one) => one !== id), id];
}

/** The line with one card brought to the front. */
export function toFront(line: readonly string[], id: string): string[] {
  return [id, ...line.filter((one) => one !== id)];
}

/**
 * The page of the deck a card opens at: that of the first requirement, in the use case's order, whose
 * words the AI found on a page of the deck anyone may read; nothing when no requirement points to one.
 */
export function deckPageOf(
  candidate: Pick<MatchingCandidate, "findings" | "listed">,
  needs: Pick<Need, "position">[],
): { page: number; quote: string } | undefined {
  for (const need of needs) {
    const finding = findingOf(candidate, need.position);
    const opening = finding && openingOf(finding, candidate.listed);
    if (finding && opening?.how === "deck") {
      return { page: opening.page, quote: finding.quote };
    }
  }
  return undefined;
}
