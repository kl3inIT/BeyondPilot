"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Document, Page, pdfjs } from "react-pdf";

// The worker is PDF.js's own file, served from this application. react-pdf asks that it be set in the
// module that draws the pages, as matching-deck-pages.tsx does for the matching deck.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

/** A page is never drawn wider than this, so a slide reads as a slide on a wide screen. */
const MAX_WIDTH = 1040;

type PdfViewerPagesProps = {
  /** Where the PDF is read, on this origin. */
  url: string;
  /** Shown while the file and its pages are on their way. */
  loading: ReactNode;
  /** Called once the file is open, with how many pages it has. */
  onOpened: (pages: number) => void;
  /** Called with the page that fills most of the view, from 1, as the reader scrolls. */
  onPage: (page: number) => void;
  /** Called when the file or a page of it cannot be shown. */
  onFailed: () => void;
  /** Names a page for assistive technology. */
  pageLabel: (page: number) => string;
};

/**
 * Every page of a PDF, one under the other, as wide as the view allows. The page that fills most of
 * the view is reported, so that the reader can say where they are.
 */
function PdfViewerPages({
  url,
  loading,
  onOpened,
  onPage,
  onFailed,
  pageLabel,
}: PdfViewerPagesProps) {
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>();
  const [pages, setPages] = useState(0);

  useEffect(() => {
    const element = frame.current;
    if (!element) {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width > 0) {
        setWidth(Math.min(MAX_WIDTH, Math.floor(entry.contentRect.width)));
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = frame.current;
    if (!element || pages === 0) {
      return undefined;
    }
    const seen = new Map<Element, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          seen.set(entry.target, entry.intersectionRatio);
        }
        let best: Element | undefined;
        for (const [target, ratio] of seen) {
          if (ratio > 0 && (!best || ratio > (seen.get(best) ?? 0))) {
            best = target;
          }
        }
        const page = best instanceof HTMLElement ? Number(best.dataset.page) : NaN;
        if (Number.isInteger(page)) {
          onPage(page);
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    element.querySelectorAll('[data-slot="pdf-page"]').forEach((page) => observer.observe(page));
    return () => observer.disconnect();
  }, [pages, onPage]);

  return (
    <div ref={frame} className="w-full">
      {width !== undefined && (
        <Document
          file={url}
          loading={loading}
          error=""
          noData=""
          onLoadSuccess={(pdf) => {
            setPages(pdf.numPages);
            onOpened(pdf.numPages);
          }}
          onLoadError={onFailed}
          onSourceError={onFailed}
          className="flex flex-col items-center gap-4"
        >
          {Array.from({ length: pages }, (_, index) => (
            <div
              key={index}
              role="group"
              aria-label={pageLabel(index + 1)}
              data-slot="pdf-page"
              data-page={index + 1}
              className="w-fit overflow-hidden rounded-sm shadow-card ring-1 ring-border"
            >
              <Page
                pageNumber={index + 1}
                width={width}
                loading=""
                error=""
                renderAnnotationLayer={false}
                renderTextLayer={false}
                onRenderError={onFailed}
              />
            </div>
          ))}
        </Document>
      )}
    </div>
  );
}

export default PdfViewerPages;
