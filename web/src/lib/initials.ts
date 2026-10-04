/** First letters of the first and last word of the name; the address's first letter without one. */
export function initials(name: string | null, email: string) {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const letters =
    words.length > 1 ? [words[0], words[words.length - 1]] : [words[0] ?? email.trim()];
  return letters
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toLocaleUpperCase();
}
