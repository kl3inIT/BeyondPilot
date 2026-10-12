/**
 * First letters of the first and last word of the name; the address's first letter without one.
 * A word gives its first letter or digit, and a word with neither, such as "-", is passed over.
 */
export function initials(name: string | null, email: string) {
  const first = (word: string) => /[\p{L}\p{N}]/u.exec(word)?.[0] ?? "";
  const words = (name?.trim().split(/\s+/) ?? []).filter((word) => first(word) !== "");
  const letters =
    words.length > 1 ? [words[0], words[words.length - 1]] : [words[0] ?? email.trim()];
  return letters.map(first).join("").toLocaleUpperCase();
}
