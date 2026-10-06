/** Opens a matched word in a snippet the search API sends; a control character no text carries. */
const MARK_START = String.fromCharCode(2);

/** Closes a matched word. */
const MARK_END = String.fromCharCode(3);

export type SnippetPart = { text: string; matched: boolean };

/**
 * A snippet as plain parts: the words the query matched, and the text between them. The marks are
 * characters, not markup, so nothing in a snippet is ever read as HTML; an unclosed mark ends at
 * the end of the text.
 */
export function snippetParts(snippet: string): SnippetPart[] {
  const parts: SnippetPart[] = [];
  let rest = snippet;
  while (rest.length > 0) {
    const start = rest.indexOf(MARK_START);
    if (start < 0) {
      parts.push({ text: rest, matched: false });
      break;
    }
    if (start > 0) {
      parts.push({ text: rest.slice(0, start), matched: false });
    }
    const end = rest.indexOf(MARK_END, start + 1);
    const word = rest.slice(start + 1, end < 0 ? undefined : end);
    if (word) {
      parts.push({ text: word, matched: true });
    }
    rest = end < 0 ? "" : rest.slice(end + 1);
  }
  return parts;
}
