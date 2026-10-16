import type { ReviewCriterion } from "@/lib/api/generated";

/** The five levels a criterion is scored at, the lowest first. */
export const LEVELS = [1, 2, 3, 4, 5] as const;

/** The most points a criterion may be worth, in steps of 5. */
export const POINT_CHOICES = Array.from({ length: 20 }, (_, index) => (index + 1) * 5);

/**
 * The points the program's criteria add up to, or null when they are not worth points and a score
 * is the mean of the levels, 1 to 5.
 */
export function maxTotal(criteria: ReviewCriterion[]): number | null {
  if (criteria.length === 0 || criteria.some((criterion) => criterion.maxPoints == null)) {
    return null;
  }
  return criteria.reduce((sum, criterion) => sum + (criterion.maxPoints ?? 0), 0);
}

/** The points a level gives on a criterion worth `max` points. */
export function levelPoints(level: number, max: number) {
  return (level * max) / LEVELS.length;
}

/** A score as the review reads it: points out of the program's total, or the mean of the levels. */
export function scoreText(value: number, total: number | null) {
  return total == null ? value.toFixed(1) : `${Number(value.toFixed(1))} / ${total}`;
}
