/**
 * The record to review after one was decided: the next one of the list on screen that still waits,
 * going down from the one decided and round to the top, so nothing above it is left behind. Null
 * when every record of the list was decided.
 *
 * @param waiting the ids that waited when the list was read, in its order
 * @param decided the ids decided since, the one just decided last
 */
export function nextWaiting(waiting: readonly string[], decided: readonly string[]): string | null {
  const left = waiting.filter((id) => !decided.includes(id));
  const from = waiting.indexOf(decided.at(-1) ?? "");
  return left.find((id) => waiting.indexOf(id) > from) ?? left[0] ?? null;
}
