import type { ReviewApplicationItem } from "@/lib/api/generated";

/**
 * Whether the caller still has this application to score: their own is never theirs to score, and
 * once the outcomes are released only the shortlisted are still scored.
 */
export function waits(item: ReviewApplicationItem, released = false) {
  return item.mine === "none" && !item.own && (!released || item.shortlisted);
}

/**
 * Where a judge stands in a program's applications: how many they have yet to score, and the next
 * of those after this one, going round to the start of the list. Nothing is next when the only one
 * left is the one on show.
 */
export function judgeQueue(items: ReviewApplicationItem[], currentId: string, released = false) {
  const left = items.filter((item) => waits(item, released)).length;
  const index = items.findIndex((item) => item.id === currentId);
  const after = index < 0 ? items : [...items.slice(index + 1), ...items.slice(0, index)];
  return { left, nextId: after.find((item) => waits(item, released))?.id ?? null };
}
