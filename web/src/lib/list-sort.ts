/** The order of a list: the key it sorts by and whether the largest or latest comes first. */
export type ListSort<K extends string> = { key: K; desc: boolean };

/**
 * The order `?sort=` names, as the server applies it: `score` ascending, `-score` descending. An
 * empty value, or a key the list does not sort by, gives the list's own default
 * (docs/conventions.md › Lists).
 */
export function listSort<K extends string>(
  sort: string,
  keys: readonly K[],
  fallback: ListSort<K>,
): ListSort<K> {
  const desc = sort.startsWith("-");
  const key = keys.find((candidate) => candidate === (desc ? sort.slice(1) : sort));
  return key ? { key, desc } : fallback;
}

/** The value of `?sort=` for an order. */
export function sortParam<K extends string>(sort: ListSort<K>): string {
  return `${sort.desc ? "-" : ""}${sort.key}`;
}
