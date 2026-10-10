import type { ReviewApplicationItem } from "@/lib/api/generated";

/** Whether the caller still has this application to score: their own is never theirs to score. */
function waits(item: ReviewApplicationItem) {
  return item.mine === "none" && !item.own;
}

/**
 * Where a judge stands in a program's applications: how many they have yet to score, and the next
 * of those after this one, going round to the start of the list. Nothing is next when the only one
 * left is the one on show.
 */
export function judgeQueue(items: ReviewApplicationItem[], currentId: string) {
  const left = items.filter(waits).length;
  const index = items.findIndex((item) => item.id === currentId);
  const after = index < 0 ? items : [...items.slice(index + 1), ...items.slice(0, index)];
  return { left, nextId: after.find(waits)?.id ?? null };
}
