"use client";

import { CheckIcon, ClockIcon, Undo2Icon, XIcon } from "lucide-react";
import { AnimatePresence, domMax, LazyMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useState } from "react";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { Kbd } from "@/components/ui/kbd";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { MatchingCandidate } from "@/lib/api/generated";

import { ARROWED, FIELDS, OVERLAYS } from "./matching-keys";
import type { Removal } from "./matching-remove";
import { lineOf, listOrder, toEnd, toFront, type Step } from "./matching-line";
import { MatchingReviewCard, type Leaving } from "./matching-review-card";
import type { Need } from "./matching-view";

/** What gave a decision: a drag of the card, a button, or a key. */
type By = NonNullable<Leaving>["by"];

/** The reasons for a solution that is not a fit, in the order the list's picker offers them. */
const reasons = [
  "does_not_solve",
  "wrong_industry_or_size",
  "closed_or_wrong_website",
  "duplicate",
  "other",
] as const satisfies Removal["reason"][];

type MatchingReviewProps = {
  candidates: MatchingCandidate[];
  needs: Need[];
  /** Whether a run is reading solutions now, so that more may come. */
  reading: boolean;
  /** Each resolves to whether the request was kept; the board says why when it was not. */
  onShortlist: (candidate: MatchingCandidate) => Promise<boolean>;
  onRemove: (candidate: MatchingCandidate) => Promise<boolean>;
  onReason: (candidate: MatchingCandidate, reason: Removal["reason"]) => Promise<boolean>;
  onRestore: (candidate: MatchingCandidate) => Promise<boolean>;
  /** Shows the list instead. */
  onList: () => void;
};

/**
 * The matched solutions one at a time: the card in front, and under it the three decisions with their
 * keys, then a line that says what was just decided with Undo. After "not a fit" that line offers the
 * reasons, one press each and never asked for. A decision is sent at once and the card leaves; when the
 * request fails the card comes back to the front. Later records nothing: the card goes behind every other.
 * Undo takes back the decisions of this visit one at a time, last first.
 */
function MatchingReview({
  candidates,
  needs,
  reading,
  onShortlist,
  onRemove,
  onReason,
  onRestore,
  onList,
}: MatchingReviewProps) {
  const t = useTranslations("Matching.review");
  const reasonName = useTranslations("Matching.remove.reasons");
  const [order, setOrder] = useState(() => listOrder(candidates));
  const [front, setFront] = useState<string | null>(null);
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [trail, setTrail] = useState<Step[]>([]);
  const [leaving, setLeaving] = useState<Leaving>(null);
  /** The decision Undo last took back: its card comes in from the side it left by. */
  const [back, setBack] = useState<Step["kind"] | null>(null);
  /** Whether a key did the last thing: what a key does moves nothing. */
  const [quick, setQuick] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const line = lineOf(order, candidates, gone, front);
  const current = line[0];
  // The first card to show is held from then on, so that a solution read meanwhile does not take its place.
  if (front === null && current) {
    setFront(current.id);
    setOrder(line.map((one) => one.id));
  }
  const ids = line.map((one) => one.id);
  const inGroups = candidates.filter((one) => one.judged && one.bucket !== "none").length;
  const last = trail.at(-1);
  const lastOne = last && candidates.find((one) => one.id === last.id);

  /** Moves on to the next card and remembers how the one in front left. */
  function advance(step: Step, by: By, next: string[]) {
    setLeaving({ kind: step.kind, by });
    setQuick(by === "key");
    setBack(null);
    setTrail((before) => [...before, step]);
    setOrder(next);
    setFront(next[0] ?? null);
  }

  /** Puts a card back in front, as it was before its step. */
  function bringBack(id: string, from: Step["kind"], by: By) {
    setLeaving(by === "key" ? { kind: from, by } : null);
    setQuick(by === "key");
    setBack(from);
    setGone((before) => new Set([...before].filter((one) => one !== id)));
    setOrder((before) => toFront(before, id));
    setFront(id);
  }

  async function decide(kind: Step["kind"], by: By) {
    if (!current || busy !== null) {
      return;
    }
    const step = { id: current.id, kind };
    if (kind === "later") {
      if (line.length > 1) {
        advance(step, by, toEnd(ids, current.id));
      }
      return;
    }
    setGone((before) => new Set([...before, current.id]));
    advance(
      step,
      by,
      ids.filter((id) => id !== current.id),
    );
    setBusy(current.id);
    const kept = await (kind === "shortlisted" ? onShortlist(current) : onRemove(current));
    setBusy(null);
    if (!kept) {
      setTrail((before) => before.filter((one) => one !== step));
      bringBack(current.id, kind, by);
    }
  }

  async function undo(by: By) {
    if (!last || !lastOne || busy !== null) {
      return;
    }
    if (last.kind !== "later") {
      setBusy(last.id);
      const kept = await onRestore(lastOne);
      setBusy(null);
      if (!kept) {
        return;
      }
    }
    setTrail((before) => before.slice(0, -1));
    bringBack(last.id, last.kind, by);
  }

  // Four keys do what the controls under the card do. A key held with a modifier, typed in a field,
  // pressed while something lies over the page, or an arrow where arrows already move something (the
  // reasons, the deck's page), is left alone.
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(FIELDS) || document.querySelector(OVERLAYS)) {
      return;
    }
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const arrowed = target?.closest(`${ARROWED}, [data-slot="matching-deck-page"]`);
    const kinds: Record<string, Step["kind"]> = {
      ArrowRight: "shortlisted",
      ArrowLeft: "removed",
      ArrowDown: "later",
    };
    if (kinds[key] && !arrowed && current) {
      event.preventDefault();
      void decide(kinds[key], "key");
    } else if (key === "z" && last) {
      event.preventDefault();
      void undo("key");
    }
  });
  useEffect(() => {
    const listen = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", listen);
    return () => window.removeEventListener("keydown", listen);
  }, []);

  const saved = candidates.filter((one) => one.decision === "shortlisted").length;

  return (
    <div className="flex flex-col gap-4">
      {current && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t("left", { left: line.length, total: inGroups })}
        </p>
      )}

      {/* A card on its way out is lifted out of the flow here, and what passes the edge is not scrolled to. */}
      <LazyMotion features={domMax} strict>
        <div className="relative clip-stage">
          <AnimatePresence mode="popLayout" initial={false} custom={leaving}>
            {current ? (
              <MatchingReviewCard
                key={current.id}
                candidate={current}
                needs={needs}
                leaving={leaving}
                back={back}
                quick={quick}
                onDecide={(kind) => {
                  // Nothing is decided while another decision is on its way: the card springs back.
                  if (busy !== null) {
                    return false;
                  }
                  void decide(kind, "drag");
                  return true;
                }}
              />
            ) : (
              <div
                key="end"
                className="flex flex-col items-start gap-3 rounded-2xl border bg-card p-6"
              >
                <h2 className="text-lg font-semibold">
                  {trail.length > 0 ? t(reading ? "end.reading" : "end.title") : t("none")}
                </h2>
                {trail.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t("end.saved", { count: saved })}
                  </p>
                )}
                <Button prominence="secondary" onClick={onList}>
                  {t("end.list")}
                </Button>
              </div>
            )}
          </AnimatePresence>
        </div>
      </LazyMotion>

      <div className="flex flex-col items-center gap-3">
        {current && (
          <div
            role="group"
            aria-label={t("actions.label", { name: current.solutionName })}
            className="flex flex-wrap items-center justify-center gap-2"
          >
            <Button
              prominence="secondary"
              aria-keyshortcuts="ArrowLeft"
              onClick={() => void decide("removed", "press")}
            >
              <XIcon aria-hidden="true" />
              {t("actions.remove")}
              <Kbd className="max-sm:hidden">←</Kbd>
            </Button>
            <Button
              prominence="secondary"
              aria-keyshortcuts="ArrowDown"
              disabled={line.length < 2}
              onClick={() => void decide("later", "press")}
            >
              <ClockIcon aria-hidden="true" />
              {t("actions.later")}
              <Kbd className="max-sm:hidden">↓</Kbd>
            </Button>
            <Button
              aria-keyshortcuts="ArrowRight"
              onClick={() => void decide("shortlisted", "press")}
            >
              <CheckIcon aria-hidden="true" />
              {t("actions.save")}
              <Kbd className="max-sm:hidden">→</Kbd>
            </Button>
          </div>
        )}

        <div
          aria-live="polite"
          className="flex min-h-9 flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm"
        >
          {lastOne && last && (
            <>
              <span>
                {last.kind === "shortlisted"
                  ? t("last.saved", { name: lastOne.solutionName })
                  : last.kind === "removed"
                    ? t("last.removed", { name: lastOne.solutionName })
                    : t("last.later", { name: lastOne.solutionName })}
              </span>
              {last.kind === "removed" && (
                <ToggleGroup
                  aria-label={t("reasons", { name: lastOne.solutionName })}
                  variant="outline"
                  size="sm"
                  className="flex-wrap justify-center"
                  // The removal is reasoned once it is kept; until then there is nothing to give a reason to.
                  disabled={lastOne.decision !== "removed" || busy !== null}
                  value={lastOne.removedReason ? [lastOne.removedReason] : []}
                  onValueChange={(next) => {
                    const picked = reasons.find((one) => one === next[0]);
                    if (picked) {
                      void onReason(lastOne, picked);
                    }
                  }}
                >
                  {reasons.map((reason) => (
                    <ToggleGroupItem key={reason} value={reason}>
                      {reasonName(reason)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}
              <TextButton
                size="sm"
                aria-keyshortcuts="Z"
                disabled={busy !== null}
                onClick={() => void undo("press")}
              >
                <Undo2Icon aria-hidden="true" />
                {t("actions.undo")}
                <Kbd className="max-sm:hidden">Z</Kbd>
              </TextButton>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground max-sm:hidden">{t("hint")}</p>
        <p className="text-center text-xs text-muted-foreground">{t("shared")}</p>
      </div>
    </div>
  );
}

export { MatchingReview };
