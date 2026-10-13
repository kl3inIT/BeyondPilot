"use client";

import { ExternalLinkIcon, FileQuestionIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useState, type Ref } from "react";

import { TextButton } from "@/components/actions/text-button";
import { SolutionLogo } from "@/features/solution/solution-logo";
import type { MatchingCandidate } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { DeckReader } from "./matching-deck";
import { FindingItem } from "./matching-panel";
import { useCandidateMeta } from "./matching-row";
import { deckPageOf, type Step } from "./matching-line";
import { findingOf, type Need } from "./matching-view";

/** Which way the card in front leaves: a saved card to the right, one not a fit to the left. */
export type Leaving = Step["kind"] | null;

type MatchingReviewCardProps = {
  candidate: MatchingCandidate;
  needs: Need[];
  /** How the card leaves when it goes, which the line sets before it goes. */
  leaving: Leaving;
  /** The card's element, which the line measures to lift a leaving card out of the flow. */
  ref?: Ref<HTMLElement>;
};

/**
 * One solution as a card of the one-by-one review: who it is and how it fits in its head; the page of
 * its deck that the AI quotes, with the words highlighted, beside the summary and each requirement with
 * the vendor's words. A requirement whose words are on a page of the deck turns the deck to that page.
 * A solution with no page of a deck to show says so where the deck would be. The card comes up from
 * behind and leaves to the side of the decision; with reduced motion it only fades.
 */
function MatchingReviewCard({ candidate, needs, leaving, ref }: MatchingReviewCardProps) {
  const t = useTranslations("Matching");
  const meta = useCandidateMeta()(candidate);
  const still = useReducedMotion();
  const first = deckPageOf(candidate, needs);
  const [deck, setDeck] = useState(first);
  const summary = candidate.summary?.trim();
  // Read when the card leaves: the line hands the way it goes to the card that is no longer there.
  const variants = {
    enter: still ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 },
    shown: { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 },
    exit: (how: Leaving) => {
      const away = how === "shortlisted" ? 480 : how === "removed" ? -480 : 0;
      return still
        ? { opacity: 0 }
        : { opacity: 0, x: away, y: how === "later" ? 24 : 0, rotate: away / 40 };
    },
  };

  return (
    <motion.article
      ref={ref}
      aria-labelledby={`review-${candidate.id}`}
      className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm lg:h-200"
      variants={variants}
      custom={leaving}
      initial="enter"
      animate="shown"
      exit="exit"
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
    >
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <SolutionLogo
          name={candidate.solutionName}
          fileId={candidate.logoFileId}
          size="card"
          className="size-10 rounded-lg text-xs"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 id={`review-${candidate.id}`} className="truncate text-lg font-semibold">
            {candidate.solutionName}
          </h2>
          {meta && <p className="text-sm text-muted-foreground">{meta}</p>}
        </div>
        <p className="rounded-full bg-muted px-3 py-1 text-sm">
          {t("review.group", {
            group: t(`groups.${candidate.bucket === "none" ? "direct" : candidate.bucket}.title`),
            met: candidate.requiredMet,
            total: candidate.requiredTotal,
          })}
        </p>
      </header>

      {candidate.decision !== "none" && (
        <p role="status" className="border-b bg-muted px-4 py-2 text-sm">
          {t(`review.meanwhile.${candidate.decision}`)}
        </p>
      )}

      <div className="grid min-h-0 flex-1 lg:grid-cols-5">
        <div className="flex h-120 min-h-0 flex-col border-b bg-muted/40 lg:col-span-3 lg:h-auto lg:border-r lg:border-b-0">
          {deck ? (
            <DeckReader
              // Another page asked for by a requirement is a new reading, at that page.
              key={`${deck.page}:${deck.quote}`}
              inline
              solutionName={candidate.solutionName}
              solutionSlug={candidate.solutionSlug}
              page={deck.page}
              quote={deck.quote}
            />
          ) : (
            <p className="m-auto flex max-w-xs items-center gap-2 p-6 text-sm text-muted-foreground">
              <FileQuestionIcon aria-hidden="true" className="size-4 shrink-0" />
              {t("review.noDeck")}
            </p>
          )}
        </div>

        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto overscroll-contain p-4 lg:col-span-2">
          {summary && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">{t("review.summary")}</p>
              <p className="text-sm">{summary}</p>
            </div>
          )}
          {needs.length > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="text-base font-semibold">{t("review.needs")}</h3>
              <ul className="flex flex-col gap-5">
                {needs.map((need) => (
                  <FindingItem
                    key={need.position}
                    statement={need.statement}
                    tag={need.required ? t("panel.required") : undefined}
                    finding={findingOf(candidate, need.position)}
                    solution={candidate}
                    onDeck={(page, quote) => setDeck({ page, quote })}
                  />
                ))}
              </ul>
            </section>
          )}
          {candidate.listed && (
            <TextButton
              href={`${siteRoutes.solutions}/${candidate.solutionSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="self-start"
            >
              {t("row.open")}
              <ExternalLinkIcon aria-hidden="true" />
            </TextButton>
          )}
        </div>
      </div>
    </motion.article>
  );
}

export { MatchingReviewCard };
