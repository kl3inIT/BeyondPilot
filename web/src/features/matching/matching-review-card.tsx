"use client";

import { ExternalLinkIcon, FileQuestionIcon, GripVerticalIcon } from "lucide-react";
import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from "motion/react";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { useRef, useState, type Ref } from "react";

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

/** What a drag by the head decides: to the right it saves, to the left it is not a fit. */
type Dragged = Exclude<Step["kind"], "later">;

/** How far the card is dragged, in pixels, before letting go decides. */
const FAR = 150;
/** How fast a flick is, in pixels a second, for a shorter drag to decide all the same. */
const FAST = 700;
/** How far a card that leaves travels at least, so that it is off a narrow screen too. */
const AWAY = 640;

type MatchingReviewCardProps = {
  candidate: MatchingCandidate;
  needs: Need[];
  /** How the card leaves when it goes, which the line sets before it goes. */
  leaving: Leaving;
  /** The decision Undo took back, when this card is the one it brought back: it comes in from that side. */
  back: Leaving;
  /**
   * Called when the head is let go far enough, or fast enough, to one side; answers whether the
   * decision is taken, since nothing is while another one is on its way.
   */
  onDecide: (kind: Dragged) => boolean;
  /** The card's element, which the line measures to lift a leaving card out of the flow. */
  ref?: Ref<HTMLElement>;
};

/**
 * One solution as a card of the one-by-one review: who it is and how it fits in its head; the page of
 * its deck that the AI quotes, with the words highlighted, beside the summary and each requirement with
 * the vendor's words. A requirement whose words are on a page of the deck turns the deck to that page.
 * A solution with no page of a deck to show says so where the deck would be.
 *
 * Its head, and only its head, drags it, and only sideways: the deck and the evidence stay free to turn,
 * scroll and select. The card follows the pointer and tilts with it; a stamp says what letting go would
 * decide, faint at first and solid once it would. Let go far enough or fast enough, it leaves the way
 * and at the speed it was going; otherwise it springs back. It leaves the same way when a button or a
 * key decides, and a card Undo brings back comes in from the side it left by. With reduced motion it
 * neither tilts nor flies: it fades.
 */
function MatchingReviewCard({
  candidate,
  needs,
  leaving,
  back,
  onDecide,
  ref,
}: MatchingReviewCardProps) {
  const t = useTranslations("Matching");
  const meta = useCandidateMeta()(candidate);
  const still = useReducedMotion();
  const first = deckPageOf(candidate, needs);
  const [deck, setDeck] = useState(first);
  const summary = candidate.summary?.trim();
  const controls = useDragControls();
  // How far the head has pulled the card. The card itself is moved by the drag; this drives what goes
  // with it: the tilt, and the two stamps, faint on the way and solid once letting go would decide.
  const pull = useMotionValue(0);
  const tilt = useTransform(pull, [-2 * FAR, 0, 2 * FAR], still ? [0, 0, 0] : [-6, 0, 6]);
  const moved = {
    "--tilt": useTransform(tilt, (degrees) => `${degrees}deg`),
    "--save": useTransform(pull, [FAR / 5, FAR, FAR + 1], [0, 0.5, 1]),
    "--remove": useTransform(pull, [-FAR - 1, -FAR, -FAR / 5], [1, 0.5, 0]),
  } as CSSProperties;
  /** The speed the head was let go with, which the card keeps as it leaves. */
  const flick = useRef(0);
  const side = (how: Leaving) => (how === "shortlisted" ? 1 : how === "removed" ? -1 : 0);
  // Read when the card leaves: the line hands the way it goes to the card that is no longer there.
  const variants = {
    enter: still
      ? { opacity: 0 }
      : back && side(back) !== 0
        ? { opacity: 0, x: side(back) * AWAY }
        : { opacity: 0, y: 16, scale: 0.98 },
    shown: { opacity: 1, x: 0, y: 0, scale: 1 },
    exit: (how: Leaving) =>
      still
        ? { opacity: 0 }
        : {
            opacity: 0,
            x: side(how) * Math.max(AWAY, window.innerWidth),
            y: how === "later" ? 24 : 0,
            transition: {
              x: { type: "spring" as const, stiffness: 200, damping: 30, velocity: flick.current },
            },
          },
  };
  const letGo = (_: unknown, info: PanInfo) => {
    const far = Math.abs(info.offset.x) > FAR || Math.abs(info.velocity.x) > FAST;
    flick.current = info.velocity.x;
    if (far && info.offset.x !== 0 && onDecide(info.offset.x > 0 ? "shortlisted" : "removed")) {
      return;
    }
    // Not decided: the drag springs the card back, and what goes with it follows.
    void animate(pull, 0, { type: "spring", stiffness: 400, damping: 32 });
  };

  return (
    <motion.article
      ref={ref}
      aria-labelledby={`review-${candidate.id}`}
      className="relative flex rotate-(--tilt) flex-col overflow-hidden rounded-2xl border bg-card shadow-sm lg:h-200"
      style={moved}
      drag="x"
      dragControls={controls}
      dragListener={false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDrag={(_, info) => pull.set(info.offset.x)}
      onDragEnd={letGo}
      variants={variants}
      custom={leaving}
      initial="enter"
      animate="shown"
      exit="exit"
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
    >
      <header
        data-slot="matching-card-head"
        // The one place a drag starts. Touches here move the card, not the page.
        onPointerDown={(event) => controls.start(event)}
        className="flex cursor-grab touch-none flex-wrap items-center gap-3 border-b py-3 pr-4 pl-2 select-none active:cursor-grabbing"
      >
        <GripVerticalIcon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground/60" />
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

      <p
        aria-hidden="true"
        data-slot="matching-stamp"
        className="pointer-events-none absolute top-20 left-6 z-10 -rotate-6 rounded-lg border-2 border-primary bg-card/90 px-3 py-1 text-xl font-bold tracking-wide text-primary uppercase opacity-(--save)"
      >
        {t("review.actions.save")}
      </p>
      <p
        aria-hidden="true"
        data-slot="matching-stamp"
        className="pointer-events-none absolute top-20 right-6 z-10 rotate-6 rounded-lg border-2 border-muted-foreground bg-card/90 px-3 py-1 text-xl font-bold tracking-wide text-muted-foreground uppercase opacity-(--remove)"
      >
        {t("review.actions.remove")}
      </p>

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
