"use client";

import "react-pdf/dist/Page/TextLayer.css";

import type { TextContent } from "pdfjs-dist/types/src/display/api.js";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import { markUp, quoteRanges, type QuoteRange } from "./matching-quote";

// The worker is PDF.js's own file, served from this application: the bundler copies it beside the
// other static files and gives its address. It is set here, in the module that draws the pages, as
// react-pdf asks; the module is loaded only when a deck is opened (matching-deck.tsx).
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

/** What the text of one page says of the quote: where it stands, or that it was not found there. */
type Read = { page: number; ranges: Map<number, QuoteRange> | undefined };

type DeckPagesProps = {
  /** Where the PDF is read, on this origin. */
  url: string;
  /** The page shown, from 1. */
  page: number;
  /** The vendor's words and the page they are on; absent when the deck is opened for itself. */
  quote?: { page: number; text: string };
  labels: {
    /** Said to a screen reader where the quote begins and where it ends. */
    before: string;
    after: string;
  };
  /** Shown while the file and the page are on their way. */
  loading: ReactNode;
  /** Called once the file is open, with how many pages it has. */
  onOpened: (pages: number) => void;
  /** Called when the file or a page of it cannot be shown. */
  onFailed: () => void;
  /** Called once the text of the quote's page is read: whether the quote was found there. */
  onQuote: (found: boolean) => void;
};

/**
 * One page of a deck, drawn from the PDF, with the quote highlighted in the page's own text. The quote
 * is looked for in the text PDF.js reads from the page; a page that is a picture has none, and then
 * nothing is marked and the caller is told, so that it never claims a highlight.
 */
function DeckPages({
  url,
  page,
  quote,
  labels,
  loading,
  onOpened,
  onFailed,
  onQuote,
}: DeckPagesProps) {
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>();
  const [read, setRead] = useState<Read>();

  useEffect(() => {
    const element = frame.current;
    if (!element) {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      // A sheet on its way out reports no width; the last real one still holds.
      if (entry && entry.contentRect.width > 0) {
        setWidth(Math.floor(entry.contentRect.width));
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const onQuotePage = quote !== undefined && quote.page === page;
  const known = onQuotePage && read?.page === page;
  const ranges = known ? read.ranges : undefined;
  const marked = ranges ? [...ranges.keys()] : [];
  const first = marked[0];
  const last = marked[marked.length - 1];

  function onText(content: TextContent) {
    if (!quote || quote.page !== page) {
      return;
    }
    const found = quoteRanges(
      content.items.map((item) => ("str" in item ? item.str : "")),
      quote.text,
    );
    setRead({ page, ranges: found });
    onQuote(found !== undefined);
  }

  return (
    <div ref={frame} className="w-full">
      {width !== undefined && (
        <Document
          file={url}
          suspense={false}
          loading={loading}
          error=""
          noData=""
          onLoadSuccess={(deck) => onOpened(deck.numPages)}
          onLoadError={onFailed}
          onSourceError={onFailed}
        >
          <div
            data-slot="deck-page"
            data-page={page}
            // A page whose text does not hold the quote is framed whole; nothing on it is marked.
            data-quote={known ? (ranges ? "highlighted" : "framed") : undefined}
            className="mx-auto w-fit rounded-sm shadow-card ring-1 ring-border data-[quote=framed]:ring-2 data-[quote=framed]:ring-highlight-line"
          >
            <Page
              key={page}
              pageNumber={page}
              width={width}
              suspense={false}
              loading={loading}
              error=""
              renderAnnotationLayer={false}
              renderTextLayer
              customTextRenderer={
                ranges
                  ? ({ str, itemIndex }) =>
                      markUp(str, ranges.get(itemIndex), {
                        before: itemIndex === first ? labels.before : undefined,
                        after: itemIndex === last ? labels.after : undefined,
                      })
                  : undefined
              }
              onGetTextSuccess={onText}
              onGetTextError={() => {
                if (onQuotePage) {
                  setRead({ page, ranges: undefined });
                  onQuote(false);
                }
              }}
              onRenderTextLayerSuccess={() =>
                frame.current
                  ?.querySelector('mark[data-slot="deck-quote"]')
                  ?.scrollIntoView({ block: "center", inline: "nearest" })
              }
              onLoadError={onFailed}
              onRenderError={onFailed}
            />
          </div>
        </Document>
      )}
    </div>
  );
}

export default DeckPages;
