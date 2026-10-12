/**
 * A row of a list that is ordered by hand, with the key it keeps for as long as the list is open:
 * the stored identifier of a saved one, and a key made when it was added for one that is not.
 */
export type Keyed<Question> = { key: string; question: Question };

/**
 * The rows with the one at `index` moved `by` places, up for a negative number. A move past either
 * end stops at that end; the rows given are left as they were.
 */
export function moved<Row>(rows: readonly Row[], index: number, by: number): Row[] {
  const to = Math.min(Math.max(index + by, 0), rows.length - 1);
  const next = [...rows];
  const [row] = next.splice(index, 1);
  next.splice(to, 0, row);
  return next;
}
