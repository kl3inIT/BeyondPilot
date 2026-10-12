/**
 * What the public reads of an organization's description: a paragraph, then a short list when the
 * stored text names several things.
 */
export type ShownDescription = {
  /** The paragraph; with `items` under it, the sentence that introduces them. Empty for none. */
  text: string;
  /** What the description lists, in its order; empty when it lists nothing. */
  items: string[];
};

/** The old platform's separator between the items of a list it kept as one text. */
const SEPARATOR = "|||";
/** What a text cut to a length ends with: the character, or three dots or more. */
const CUT = /(\s*(…|\.{3,}))+$/;
/** The end of a sentence: its mark, any quote or bracket that closes it, then a space or the end. */
const SENTENCE_END = /[.!?]["'”’)\]]*(?=\s|$)/g;
/** Words whose full stop ends no sentence. */
const ABBREVIATIONS = new Set([
  "co",
  "corp",
  "dr",
  "etc",
  "inc",
  "ltd",
  "mr",
  "ms",
  "no",
  "st",
  "vs",
]);

function tidy(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Where the last whole sentence of the text ends, or 0 when it holds none. */
function lastSentenceEnd(text: string): number {
  let end = 0;
  for (const match of text.matchAll(SENTENCE_END)) {
    const word = text.slice(0, match.index).match(/\p{L}+$/u)?.[0] ?? "";
    // "Inc." and a letter alone, the "S." of "U.S." or the "g." of "e.g.", stop no sentence.
    const abbreviated =
      match[0].startsWith(".") && (word.length === 1 || ABBREVIATIONS.has(word.toLowerCase()));
    if (!abbreviated) {
      end = match.index + match[0].length;
    }
  }
  return end;
}

/**
 * A paragraph that was cut, back to its last whole sentence. One that was cut before its first
 * sentence ended keeps its whole words, without the last, which may be half of one, and says it
 * goes on.
 */
function wholeSentences(cut: string): string {
  const end = lastSentenceEnd(cut);
  if (end > 0) {
    return cut.slice(0, end);
  }
  const words = cut
    .split(" ")
    .slice(0, -1)
    .join(" ")
    .replace(/[\s,;:–—-]+$/, "");
  return words ? `${words}…` : "";
}

/**
 * A stored description as the public reads it. Descriptions brought from the old platform hold
 * `|||` between the items of a list and often end where they were cut to a length, in the middle
 * of an item or a sentence. The items become a list under the sentence that introduces them, what
 * was cut goes back to the last whole item or sentence, and spaces are tidied. A description a
 * person wrote, with no separator and no cut, comes back as it is. The stored text is not changed:
 * its owner reads and corrects it in the profile form.
 */
export function shownDescription(stored: string | null | undefined): ShownDescription {
  const whole = tidy(stored ?? "");
  const body = whole.replace(CUT, "");
  const cut = body.length < whole.length;

  if (!body.includes(SEPARATOR)) {
    return { text: cut ? wholeSentences(body) : body, items: [] };
  }

  const parts = body.split(SEPARATOR).map(tidy);
  if (cut) {
    // The last item is the one the cut fell in.
    parts.pop();
  }
  // What stands before the first separator introduces the list up to its last colon.
  const first = parts.shift() ?? "";
  const colon = first.endsWith(":") ? first.length - 1 : first.lastIndexOf(": ");
  const lead = colon < 0 ? "" : first.slice(0, colon + 1);
  const items = [colon < 0 ? first : first.slice(colon + 1), ...parts]
    .map((item) => tidy(item.replace(/[\s,;]+$/, "")))
    // An item named twice is listed once.
    .filter((item, at, all) => item !== "" && all.indexOf(item) === at);

  if (items.length > 1) {
    return { text: lead, items };
  }
  if (items.length === 0) {
    // Nothing of the list is left: what introduced it goes too, and the sentences before it stay.
    return { text: lead.slice(0, lastSentenceEnd(lead)), items: [] };
  }
  // One item is no list: it ends the sentence that introduced it.
  const sentence = tidy(`${lead} ${items[0]}`);
  return { text: /[.!?]$/.test(sentence) ? sentence : `${sentence}.`, items: [] };
}

/** The same description on one line, for where no list can be drawn: a page's summary for search engines. */
export function descriptionLine(stored: string | null | undefined): string {
  const { text, items } = shownDescription(stored);
  if (items.length === 0) {
    return text;
  }
  const list = items.join("; ");
  return `${text ? `${text} ` : ""}${list}${/[.!?]$/.test(list) ? "" : "."}`;
}
