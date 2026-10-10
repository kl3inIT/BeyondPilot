/**
 * Finding a vendor's quoted words on a page of their deck. The backend keeps the quote and the page,
 * not where on the page the words stand, so they are looked for in the page's text layer: the runs of
 * text PDF.js gives for the page, in reading order.
 *
 * Both sides are compared the way the backend's quote check compares them (`matching/Quotes.java`):
 * one Unicode form (NFKC) and lower case. The backend also reads any run of spaces and line ends as
 * one space; here they are left out altogether, with the soft hyphen and the hyphen, because a text
 * layer says nothing reliable about them: a line is several runs, a word may be cut in two runs, and a
 * word broken at a line end keeps its hyphen on the page and loses it in the quote.
 */

/** What the comparison leaves out: spaces and line ends, zero-width spaces, the soft hyphen, hyphens. */
const LEFT_OUT = /[\s\u00ad\u200b\u2010\u2011-]/u;

/** A letter with the marks that follow it, so that a letter written in two parts compares as one. */
const LETTER = /\P{M}\p{M}*|\p{M}+/gu;

/** The part of one run of text that a quote covers, as offsets in the run's own string. */
export type QuoteRange = { start: number; end: number };

/** Text as the comparison reads it. */
export function comparable(text: string): string {
  return read([text]).text;
}

/**
 * Where a quote stands in a page's runs of text: for each run it covers, the part it covers. Nothing
 * when the page does not hold the quote word for word, or holds no text at all; the first place when
 * it holds it twice.
 */
export function quoteRanges(
  items: readonly string[],
  quote: string,
): Map<number, QuoteRange> | undefined {
  const wanted = comparable(quote);
  if (!wanted) {
    return undefined;
  }
  const page = read(items);
  const from = page.text.indexOf(wanted);
  if (from < 0) {
    return undefined;
  }
  const ranges = new Map<number, QuoteRange>();
  for (const place of page.places.slice(from, from + wanted.length)) {
    const range = ranges.get(place.item);
    if (range) {
      range.end = place.end;
    } else {
      ranges.set(place.item, { start: place.start, end: place.end });
    }
  }
  return ranges;
}

/**
 * One run of the text layer as HTML, with the part a quote covers in a `mark`. The page's own text is
 * escaped: it comes from a vendor's file. `before` and `after` are said to a screen reader at the two
 * ends of the quote, where a sighted reader sees the highlight begin and end.
 */
export function markUp(
  text: string,
  range: QuoteRange | undefined,
  edges: { before?: string; after?: string } = {},
): string {
  if (!range || range.end <= range.start) {
    return escape(text);
  }
  const said = (words: string | undefined) =>
    words ? `<span class="sr-only">${escape(words)}</span>` : "";
  return (
    escape(text.slice(0, range.start)) +
    `<mark data-slot="deck-quote">${said(edges.before)}${escape(text.slice(range.start, range.end))}${said(edges.after)}</mark>` +
    escape(text.slice(range.end))
  );
}

function escape(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** The runs as one comparable text, and for each of its characters where it comes from. */
function read(items: readonly string[]) {
  let text = "";
  const places: { item: number; start: number; end: number }[] = [];
  items.forEach((item, index) => {
    for (const letter of item.matchAll(LETTER)) {
      const start = letter.index;
      const end = start + letter[0].length;
      for (const character of letter[0].normalize("NFKC").toLowerCase()) {
        if (!LEFT_OUT.test(character)) {
          text += character;
          // A character outside the basic plane is two units of the string, each compared.
          for (let unit = 0; unit < character.length; unit += 1) {
            places.push({ item: index, start, end });
          }
        }
      }
    }
  });
  return { text, places };
}
