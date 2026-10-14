"use client";

import { ExternalLinkIcon, FileQuestionIcon, GripVerticalIcon, MailPlusIcon } from "lucide-react";
import {
  animate,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from "motion/react";
import * as m from "motion/react-m";
import { useTranslations } from "next-intl";
import { useRef, useState, type CSSProperties, type Ref } from "react";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { SolutionLogo } from "@/features/solution/solution-logo";
import type { MatchingCandidate } from "@/lib/api/generated";
import { baseSeconds, entranceEase } from "@/lib/motion";
import { siteRoutes } from "@/lib/site";
import { cn } from "@/lib/utils";

import { DeckReader } from "./matching-deck";
import { InvitedMark } from "./matching-invite";
import { FindingItem } from "./matching-panel";
import { useCandidateMeta } from "./matching-row";
import { deckPageOf, type Step } from "./matching-line";
import { findingOf, type Need } from "./matching-view";

/**
 * How the card in front leaves: which decision, a saved card to the right and one not a fit to the left,
 * and what gave it. A drag lets the card go on the way it was going; a button moves it a short way as
 * it fades; a key, pressed many times in a row, moves nothing (docs/conventions.md › Motion).
 */
export type Leaving = { kind: Step["kind"]; by: "drag" | "press" | "key" } | null;

/** What a drag by the head decides: to the right it saves, to the left it is not a fit. */
type Dragged = Exclude<Step["kind"], "later">;

/** How far the card is dragged, in pixels, before letting go decides. */
const FAR = 150;
/** How fast a flick is, in pixels a second, for a shorter drag to decide all the same. */
const FAST = 700;
/** How far a card let go by a drag travels at least, so that it is off a narrow screen too. */
const AWAY = 640;
/** The short way a card travels when a button decides, and when Undo brings it back. */
const NEAR = 48;
/** A spring that comes to rest without passing it: nothing bounces. */
const SETTLE = { stiffness: 400, damping: 40 };

type MatchingReviewCardProps = {
  candidate: MatchingCandidate;
  needs: Need[];
  /** How the card leaves when it goes, which the line sets before it goes. */
  leaving: Leaving;
  /** The decision Undo took back, when this card is the one it brought back: it comes in from that side. */
  back: Step["kind"] | null;
  /** Whether a key brought this card up: it is then there at once. */
  quick: boolean;
  /**
   * Whether this is the card behind the one in front: drawn under it, a little smaller, with its deck
   * already open, and out of reach of the pointer, the keys and a screen reader until it comes forward.
   */
  behind: boolean;
  /**
   * Called when the head is let go far enough, or fast enough, to one side; answers whether the
   * decision is taken, since nothing is while another one is on its way.
   */
  onDecide: (kind: Dragged) => boolean;
  /**
   * Opens the invitation of the provider to propose; absent when the caller may not invite now. A
   * provider invited already reads as such instead.
   */
  onInvite?: () => void;
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
 * and at the speed it was going; otherwise it settles back. When a button decides it moves a short way
 * to its side as it fades, and a card Undo brings back comes in from the side it left by. A key moves
 * nothing: the next card is there at once. With reduced motion the card neither tilts nor travels.
 */
function MatchingReviewCard({
  candidate,
  needs,
  leaving,
  back,
  quick,
  behind,
  onDecide,
  onInvite,
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
  const side = (kind: Step["kind"] | null | undefined) =>
    kind === "shortlisted" ? 1 : kind === "removed" ? -1 : 0;
  // Read when the card leaves: the line hands the way it goes to the card that is no longer there.
  const variants = {
    enter: still
      ? { opacity: 0 }
      : side(back) !== 0
        ? { opacity: 0, x: side(back) * NEAR }
        : { opacity: 0, y: 16, scale: 0.98 },
    shown: { opacity: 1, x: 0, y: 0, scale: 1 },
    // Under the card in front: its lower edge shows, which says another card waits.
    under: still ? { opacity: 1 } : { opacity: 1, x: 0, y: 20, scale: 0.97 },
    exit: (how: Leaving) => {
      // The card behind is taken away unseen, as when Undo puts another card in front of it.
      if (behind || how?.by === "key") {
        return { opacity: 0, transition: { duration: 0 } };
      }
      // An exit is shorter than its entrance.
      const fade = { duration: baseSeconds * 0.75, ease: "easeIn" as const };
      if (still) {
        return { opacity: 0, transition: fade };
      }
      if (how?.by === "drag") {
        return {
          opacity: 0,
          x: side(how.kind) * Math.max(AWAY, window.innerWidth),
          transition: {
            // It comes to rest soon after it is out of sight, and is then taken from the page.
            x: { type: "spring" as const, ...SETTLE, restDelta: 1, velocity: flick.current },
            opacity: { duration: baseSeconds },
          },
        };
      }
      return {
        opacity: 0,
        x: side(how?.kind) * NEAR,
        y: how?.kind === "later" ? 16 : 0,
        transition: fade,
      };
    },
  };
  const letGo = (_: unknown, info: PanInfo) => {
    const far = Math.abs(info.offset.x) > FAR || Math.abs(info.velocity.x) > FAST;
    flick.current = info.velocity.x;
    if (far && info.offset.x !== 0 && onDecide(info.offset.x > 0 ? "shortlisted" : "removed")) {
      return;
    }
    // Not decided: the drag springs the card back, and what goes with it follows.
    void animate(pull, 0, { type: "spring", ...SETTLE });
  };

  return (
    <m.article
      ref={ref}
      aria-labelledby={`review-${candidate.id}`}
      aria-hidden={behind || undefined}
      inert={behind}
      className={cn(
        "flex rotate-(--tilt) flex-col overflow-hidden rounded-2xl border bg-card shadow-sm lg:h-200",
        behind ? "absolute inset-0" : "relative z-10",
      )}
      style={moved}
      drag={behind ? false : "x"}
      dragControls={controls}
      dragListener={false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      dragTransition={{ bounceStiffness: SETTLE.stiffness, bounceDamping: SETTLE.damping }}
      onDrag={(_, info) => pull.set(info.offset.x)}
      onDragEnd={letGo}
      variants={variants}
      custom={leaving}
      // The card behind is simply there; the one in front comes in, unless a key brought it.
      initial={behind || quick ? false : "enter"}
      animate={behind ? "under" : "shown"}
      exit="exit"
      transition={{ duration: quick ? 0 : baseSeconds, ease: entranceEase }}
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
        <p className="rounded-full bg-muted px-3 py-1 text-sm max-sm:basis-full max-sm:text-center">
          {t("review.group", {
            group: t(`groups.${candidate.bucket === "none" ? "direct" : candidate.bucket}.title`),
            met: candidate.requiredMet,
            total: candidate.requiredTotal,
          })}
        </p>
        {candidate.invitedAt ? (
          <InvitedMark candidate={candidate} />
        ) : (
          onInvite && (
            // A press here invites; it does not start a drag of the card.
            <Button
              size="sm"
              prominence="secondary"
              className="max-sm:w-full"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onInvite}
            >
              <MailPlusIcon aria-hidden="true" />
              {t("invite.action")}
            </Button>
          )
        )}
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
        <div className="flex min-h-0 flex-col border-b bg-muted/40 lg:col-span-3 lg:border-r lg:border-b-0">
          {deck ? (
            <DeckReader
              // Another page asked for by a requirement is a new reading, at that page.
              key={`${deck.page}:${deck.quote ?? ""}`}
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
    </m.article>
  );
}

export { MatchingReviewCard };
