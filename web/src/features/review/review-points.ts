import type { ReviewCriterion } from "@/lib/api/generated";

/** The scores a criterion takes, 1 to 10. */
export const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** What a score means, by the band it falls in, as the panel shows above the scale. */
export const BANDS = ["weak", "average", "strong", "outstanding"] as const;

export function bandOf(score: number): (typeof BANDS)[number] {
  return score <= 3 ? "weak" : score <= 6 ? "average" : score <= 8 ? "strong" : "outstanding";
}

/**
 * The points the program's criteria weigh together, or null when they have no points and a score
 * is the mean of the scores, 1 to 10.
 */
export function maxTotal(criteria: ReviewCriterion[]): number | null {
  if (criteria.length === 0 || criteria.some((criterion) => criterion.maxPoints == null)) {
    return null;
  }
  return criteria.reduce((sum, criterion) => sum + (criterion.maxPoints ?? 0), 0);
}

/** A score as the review reads it: points out of the program's total, or the mean of the scores. */
export function scoreText(value: number, total: number | null) {
  return total == null ? value.toFixed(1) : `${Number(value.toFixed(1))} / ${total}`;
}
