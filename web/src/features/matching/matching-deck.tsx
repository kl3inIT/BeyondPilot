"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  Loader2Icon,
  XIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { IconButton } from "@/components/actions/icon-button";
import { TextButton } from "@/components/actions/text-button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { deckAddress } from "@/features/solution/solution-deck";

/** Said while the deck, or the code that draws it, is on its way. */
function DeckLoading() {
  const t = useTranslations("Matching.deck");
  return (
    <p role="status" className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
      <Loader2Icon
        aria-hidden="true"
        className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
      />
      {t("loading")}
    </p>
  );
}

// PDF.js and the code that draws a page are loaded when a deck is first opened, in the browser only:
// the page's first load does not carry them.
const DeckPages = dynamic(() => import("./matching-deck-pages"), {
  ssr: false,
  loading: () => <DeckLoading />,
});

type DeckReaderProps = {
  solutionName: string;
  solutionSlug: string;
  /** The page the deck opens at, from 1. */
  page: number;
  /** The vendor's words on that page; absent when the deck is opened for itself. */
  quote?: string;
};

/**
 * The inside of the sheet: whose deck it is and which page, the steps to the pages around it, the file
 * itself in a new tab, and the page with the quote highlighted. When the page's text does not hold the
 * quote, as on a page that is a picture, the quote is printed under the title and the page is framed
 * whole: nothing is marked that was not found.
 */
function DeckReader({ solutionName, solutionSlug, page: first, quote }: DeckReaderProps) {
  const t = useTranslations("Matching.deck");
  const [page, setPage] = useState(first);
  const [total, setTotal] = useState<number>();
  const [failed, setFailed] = useState(false);
  /** Whether the quote was found in the text of its page; unknown until that text is read. */
  const [found, setFound] = useState<boolean>();
  const said = quote?.trim();
  const shown = total === undefined ? page : Math.min(page, total);
  const file = `${deckAddress(solutionSlug)}#page=${shown}`;
  const onQuotePage = said !== undefined && said !== "" && shown === first;
  const openFile = (
    <TextButton href={file} target="_blank" rel="noopener noreferrer">
      {t("file")}
      <ExternalLinkIcon aria-hidden="true" />
    </TextButton>
  );

  return (
    <>
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className="flex min-w-0 flex-col gap-1">
          <SheetTitle className="wrap-break-word">{solutionName}</SheetTitle>
          <SheetDescription>
            {total === undefined ? t("page", { page: shown }) : t("pageOf", { page: shown, total })}
          </SheetDescription>
          {/* A live region from the start: it speaks once the text of the quote's page is read. */}
          <p role="status" className="text-sm text-muted-foreground">
            {!failed && onQuotePage && found !== undefined && t(found ? "highlighted" : "onPage")}
          </p>
        </div>
        <SheetClose render={<IconButton prominence="tertiary" size="lg" aria-label={t("close")} />}>
          <XIcon aria-hidden="true" />
        </SheetClose>
      </div>

      {failed ? (
        <div role="alert" className="flex flex-col items-start gap-2 px-5 pb-6">
          <p className="text-sm font-medium">{t("failed")}</p>
          {openFile}
        </div>
      ) : (
        <>
          {onQuotePage && found === false && (
            <blockquote className="mx-5 border-l-2 pl-3 text-sm wrap-break-word">
              <q>{said}</q>
            </blockquote>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5">
            <div className="flex items-center gap-1">
              <IconButton
                size="sm"
                aria-label={t("previous")}
                disabled={shown <= 1}
                onClick={() => setPage(shown - 1)}
              >
                <ChevronLeftIcon aria-hidden="true" />
              </IconButton>
              <IconButton
                size="sm"
                aria-label={t("next")}
                disabled={total === undefined || shown >= total}
                onClick={() => setPage(shown + 1)}
              >
                <ChevronRightIcon aria-hidden="true" />
              </IconButton>
            </div>
            {said && shown !== first && (
              <TextButton onClick={() => setPage(first)}>{t("back", { page: first })}</TextButton>
            )}
            <div className="ml-auto">{openFile}</div>
          </div>

          {/* A tall page scrolls here; the region takes the focus so that the keys scroll it too. */}
          <div
            role="group"
            aria-label={t("pageLabel", { page: shown })}
            tabIndex={0}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-1 pb-6 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
          >
            <DeckPages
              url={deckAddress(solutionSlug)}
              page={shown}
              quote={said ? { page: first, text: said } : undefined}
              labels={{ before: t("before"), after: t("after") }}
              loading={<DeckLoading />}
              onOpened={setTotal}
              onFailed={() => setFailed(true)}
              onQuote={setFound}
            />
          </div>
        </>
      )}
    </>
  );
}

type MatchingDeckProps = DeckReaderProps & {
  /** The words of the control that opens the deck. */
  children: ReactNode;
};

/**
 * A control that opens a solution's deck in a wide sheet, at one page, with the vendor's words
 * highlighted there. Only for a solution whose deck anyone may read at its public address. Focus moves
 * into the sheet and comes back to the control when it closes.
 */
function MatchingDeck({ children, ...deck }: MatchingDeckProps) {
  return (
    <Sheet>
      <SheetTrigger render={<TextButton size="sm" />}>{children}</SheetTrigger>
      <SheetContent
        showCloseButton={false}
        className="data-[side=right]:w-full data-[side=right]:sm:max-w-3xl"
      >
        <DeckReader {...deck} />
      </SheetContent>
    </Sheet>
  );
}

export { MatchingDeck };
