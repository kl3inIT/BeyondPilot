import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { comparable, markUp, quoteRanges } from "./matching-quote";

/** The words each run shows as marked, in order. */
function marked(items: string[], quote: string) {
  const ranges = quoteRanges(items, quote);
  return ranges
    ? [...ranges.entries()].map(([item, range]) => [
        item,
        items[item].slice(range.start, range.end),
      ])
    : undefined;
}

describe("comparable", () => {
  it("reads one Unicode form in lower case, without spaces, line ends or hyphens", () => {
    expect(comparable("  Real-Time\n Fraud\u00a0Detec\u00adtion ")).toBe("realtimefrauddetection");
    // A ligature and a full-width letter are the letters they stand for.
    expect(comparable("ﬁnance Ａ")).toBe("financea");
    // A letter written as a base and a mark is the same letter written in one piece.
    expect(comparable("Vie\u0323\u0302t")).toBe(comparable("Việt"));
    expect(comparable(" \n\u00ad- ")).toBe("");
  });
});

describe("quoteRanges", () => {
  it("finds a quote inside one run and marks only its words", () => {
    expect(
      marked(["Peakflo flags unusual invoices before payment."], "flags unusual invoices"),
    ).toEqual([[0, "flags unusual invoices"]]);
  });

  it("finds a quote whatever its case and spacing", () => {
    expect(marked(["It  FLAGS unusual   invoices"], "flags Unusual invoices")).toEqual([
      [0, "FLAGS unusual   invoices"],
    ]);
  });

  it("finds a quote split over several runs of one line", () => {
    expect(
      marked(
        ["Our platform fla", "gs unus", "ual invoices", " every day"],
        "flags unusual invoices",
      ),
    ).toEqual([
      [0, "fla"],
      [1, "gs unus"],
      [2, "ual invoices"],
    ]);
  });

  it("finds a quote that runs over a line end, where the runs carry no space", () => {
    expect(
      marked(
        ["Checks every claim against", "the payment rules", "in seconds"],
        "claim against the payment rules in",
      ),
    ).toEqual([
      [0, "claim against"],
      [1, "the payment rules"],
      [2, "in"],
    ]);
  });

  it("finds a word broken at a line end, with a hyphen or a soft hyphen", () => {
    expect(
      marked(["automated fraud detec-", "tion for insurers"], "fraud detection for insurers"),
    ).toEqual([
      [0, "fraud detec"],
      [1, "tion for insurers"],
    ]);
    expect(marked(["automated fraud detec\u00ad", "tion"], "fraud detection")).toEqual([
      [0, "fraud detec"],
      [1, "tion"],
    ]);
    // And the other way: the quote keeps the soft hyphen the page does not have.
    expect(marked(["fraud detection"], "fraud detec\u00adtion")).toEqual([[0, "fraud detection"]]);
  });

  it("skips the runs that hold no text", () => {
    expect(marked(["", "flags", " ", "unusual invoices", ""], "flags unusual invoices")).toEqual([
      [1, "flags"],
      [3, "unusual invoices"],
    ]);
  });

  it("marks the letters of the page, not those of the quote", () => {
    // The page writes the ligature and a letter in two parts; the quote writes them plainly.
    expect(marked(["Trusted ﬁnance in Vie\u0323\u0302t Nam"], "finance in Việt Nam")).toEqual([
      [0, "ﬁnance in Vie\u0323\u0302t Nam"],
    ]);
  });

  it("marks the first place when the page holds the quote twice", () => {
    expect(marked(["invoices", "more invoices"], "invoices")).toEqual([[0, "invoices"]]);
  });

  it("finds nothing when the page does not hold the quote, or holds no text", () => {
    expect(quoteRanges(["It reads invoices."], "flags unusual invoices")).toBeUndefined();
    // Most of the words are not enough: a highlight is never guessed.
    expect(quoteRanges(["flags unusual", "payments"], "flags unusual invoices")).toBeUndefined();
    expect(quoteRanges([], "flags unusual invoices")).toBeUndefined();
    expect(quoteRanges(["", " "], "flags unusual invoices")).toBeUndefined();
    expect(quoteRanges(["flags unusual invoices"], "  ")).toBeUndefined();
  });
});

describe("a real deck", () => {
  // The deck the browser tests open (tests/e2e/fixtures/deck.pdf), read by PDF.js as the viewer reads it:
  // its second page holds the quote over a line end, its third is a picture.
  async function runsOf(pageNumber: number) {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = await readFile(new URL("../../../tests/e2e/fixtures/deck.pdf", import.meta.url));
    const opening = getDocument({ data: new Uint8Array(data), verbosity: 0 });
    const deck = await opening.promise;
    const page = await deck.getPage(pageNumber);
    const content = await page.getTextContent();
    const runs = content.items.map((item) => ("str" in item ? item.str : ""));
    await opening.destroy();
    return runs;
  }

  it("holds the quote in the text PDF.js reads from its page, over the line end", async () => {
    expect(marked(await runsOf(2), "flags unusual invoices")).toEqual([
      [2, "flags unusual"],
      [3, "invoices"],
    ]);
    // The same words are not on the title page.
    expect(quoteRanges(await runsOf(1), "flags unusual invoices")).toBeUndefined();
  });

  it("has no text on the page that is a picture, so nothing is marked there", async () => {
    const runs = await runsOf(3);
    expect(runs).toEqual([]);
    expect(quoteRanges(runs, "Double payment and missing invoices")).toBeUndefined();
  });
});

describe("markUp", () => {
  it("wraps the covered part in a mark and leaves the rest as it is", () => {
    expect(markUp("It flags unusual invoices today", { start: 3, end: 25 })).toBe(
      'It <mark data-slot="deck-quote">flags unusual invoices</mark> today',
    );
    expect(markUp("no quote here", undefined)).toBe("no quote here");
    expect(markUp("empty", { start: 2, end: 2 })).toBe("empty");
  });

  it("says where the quote begins and ends, for a reader who does not see the highlight", () => {
    expect(markUp("flags", { start: 0, end: 5 }, { before: "Quote: " })).toBe(
      '<mark data-slot="deck-quote"><span class="sr-only">Quote: </span>flags</mark>',
    );
    expect(markUp("invoices.", { start: 0, end: 8 }, { after: " (end of quote)" })).toBe(
      '<mark data-slot="deck-quote">invoices<span class="sr-only"> (end of quote)</span></mark>.',
    );
  });

  it("escapes the text of the vendor's file and the words said at the ends", () => {
    expect(
      markUp('a <img src=x onerror="1"> & b', { start: 2, end: 25 }, { before: "<b>", after: '"' }),
    ).toBe(
      'a <mark data-slot="deck-quote"><span class="sr-only">&lt;b&gt;</span>&lt;img src=x onerror=&quot;1&quot;&gt;<span class="sr-only">&quot;</span></mark> &amp; b',
    );
  });
});
