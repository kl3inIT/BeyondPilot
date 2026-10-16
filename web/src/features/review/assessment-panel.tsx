"use client";

import { BookmarkIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { LeaveGuard, onGuardEntry } from "@/components/composites/leave-guard";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupToggle } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useNotify } from "@/hooks/use-notify";
import { getPathname } from "@/i18n/navigation";
import { saveAssessment, type Assessment, type ReviewCriterion } from "@/lib/api/generated";

import { bandOf, maxTotal, SCORES } from "./review-points";

type AssessmentPanelProps = {
  applicationId: string;
  criteria: ReviewCriterion[];
  mine: Assessment | null;
  /** The version of the application on show; an assessment of an earlier one says so. */
  version: number;
  /** Whether the caller is a judge rather than GenAI Fund staff: the note says who reads it. */
  judge: boolean;
  /** Scores no longer change once the outcomes are released, except of a shortlisted application. */
  released: boolean;
  /** The next application of the program, which Skip and a save of the scores lead to. */
  nextHref: string | null;
};

type Pending = "save" | "note" | "bookmark" | "conflict";

/**
 * The caller's assessment of an application: each criterion scored from 1 to 10 with what the
 * numbers mean above the scale, a private note and a bookmark, or a conflict of interest that
 * leaves their score out. The note and the bookmark keep without scores, for a judge who scores
 * after hearing every pitch. Weights stay with GenAI Fund. It changes until the outcomes are
 * released.
 */
function AssessmentPanel({
  applicationId,
  criteria,
  mine,
  version,
  judge,
  released,
  nextHref,
}: AssessmentPanelProps) {
  const t = useTranslations("Review.assessment");
  const notify = useNotify();
  const router = useRouter();
  const locale = useLocale();
  const [scores, setScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(mine?.scores ?? {}).map(([id, score]) => [id, String(score)]),
    ),
  );
  const [note, setNote] = useState(mine?.note ?? "");
  const [pending, setPending] = useState<Pending | null>(null);
  const bookmarked = mine?.bookmarked ?? false;
  // What is typed here is only kept by a save, so leaving with a change asks first.
  const unsaved =
    !released &&
    (note !== (mine?.note ?? "") ||
      criteria.some(
        (criterion) => (scores[criterion.id] ?? "") !== String(mine?.scores?.[criterion.id] ?? ""),
      ));
  const complete = criteria.every((criterion) => scores[criterion.id]);
  const scored = criteria
    .filter((criterion) => scores[criterion.id])
    .map((criterion) => Number(scores[criterion.id]));
  // Judges rate quality; with weights the total is GenAI Fund's to read, not the judge's.
  const average =
    maxTotal(criteria) == null && complete && scored.length > 0
      ? scored.reduce((a, b) => a + b, 0) / scored.length
      : null;
  // One primary action a screen: "Save and next" is a judge's. An operator's is the decision above
  // this panel, and a save that leads nowhere further is a plain one.
  const saveProminence = judge && nextHref ? "primary" : "secondary";

  async function save(kind: Pending) {
    setPending(kind);
    const kept = Object.fromEntries(
      Object.entries(kind === "save" ? scores : (mine?.scores ?? {})).map(([id, score]) => [
        id,
        Number(score),
      ]),
    );
    try {
      await saveAssessment({
        path: { id: applicationId },
        body: {
          // A note or a bookmark keeps the scores already saved, or none.
          scores: kind === "conflict" || mine?.conflict ? {} : kept,
          note: note.trim() === "" ? null : note,
          // Only a save of the scores takes a declared conflict back; a note or a bookmark keeps it.
          conflict: kind === "conflict" || (kind !== "save" && (mine?.conflict ?? false)),
          bookmarked: kind === "bookmark" ? !bookmarked : bookmarked,
        },
      });
      notify.success(
        kind === "conflict"
          ? "Review.assessment.conflictSaved"
          : kind === "note"
            ? "Review.assessment.noteSaved"
            : kind === "bookmark"
              ? bookmarked
                ? "Review.assessment.bookmarkRemoved"
                : "Review.assessment.bookmarkSaved"
              : "Review.assessment.saved",
      );
      if (nextHref && kind === "save") {
        const next = getPathname({ href: nextHref, locale });
        // The entry the guard added to catch Back gives way to the next application.
        if (onGuardEntry()) {
          router.replace(next);
        } else {
          router.push(next);
        }
      } else {
        router.refresh();
      }
    } catch (error) {
      notify.failure(error);
    } finally {
      setPending(null);
    }
  }

  return (
    <section
      id="assessment"
      aria-labelledby="assessment-title"
      className="flex scroll-mt-4 flex-col gap-4 rounded-lg border bg-card p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="assessment-title" className="text-base font-semibold">
            {t("title", { version })}
          </h2>
          {mine && mine.version < version && (
            <p className="text-sm text-muted-foreground">
              {t("earlierVersion", { version: mine.version })}
            </p>
          )}
        </div>
        {!released && (
          <Button
            prominence="tertiary"
            size="sm"
            aria-pressed={bookmarked}
            pending={pending === "bookmark"}
            disabled={pending !== null}
            onClick={() => save("bookmark")}
          >
            <BookmarkIcon aria-hidden="true" className={bookmarked ? "fill-current" : undefined} />
            {bookmarked ? t("bookmarked") : t("bookmark")}
          </Button>
        )}
      </div>

      {/* A conflict leaves the scores out; scoring it after all takes the conflict back. */}
      {mine?.conflict && (
        <p className="rounded-lg border bg-muted p-3 text-sm">{t("conflictDeclared")}</p>
      )}
      {criteria.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noCriteria")}</p>
      ) : (
        <div
          role="group"
          aria-labelledby="assessment-criteria"
          aria-describedby="assessment-scale"
          className="flex min-w-0 flex-col gap-3"
        >
          {/* How far the scoring is, at every width: the bar of a narrow screen only repeats it. */}
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm font-medium">
              <span id="assessment-criteria">{t("criteria")}</span>
              <span className="flex gap-2 tabular-nums">
                <span className={complete ? "text-muted-foreground" : undefined}>
                  {t("bar.progress", { scored: scored.length, total: criteria.length })}
                </span>
                {average !== null && (
                  <span className="text-primary">
                    {t("average", { value: average.toFixed(1) })}
                  </span>
                )}
              </span>
            </div>
            <p id="assessment-scale" className="text-xs text-muted-foreground">
              {t("scale")}
            </p>
          </div>
          {criteria.map((criterion) => {
            const chosen = scores[criterion.id];
            return (
              // The scale goes under the name of its criterion, and wraps on a narrow screen.
              <div key={criterion.id} className="flex flex-col gap-1.5">
                <span className="flex min-w-0 flex-col text-sm">
                  <span id={`criterion-${criterion.id}`}>{criterion.name}</span>
                  {criterion.description && (
                    <span id={`criterion-${criterion.id}-what`} className="text-muted-foreground">
                      {criterion.description}
                    </span>
                  )}
                </span>
                {/* One score of ten: a radio group, so the arrow keys move along the scale. */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <RadioGroup
                    className="flex w-fit flex-wrap"
                    aria-labelledby={`criterion-${criterion.id}`}
                    aria-describedby={
                      criterion.description ? `criterion-${criterion.id}-what` : undefined
                    }
                    disabled={released}
                    value={chosen ?? ""}
                    onValueChange={(value) =>
                      setScores((current) => ({ ...current, [criterion.id]: String(value) }))
                    }
                  >
                    {SCORES.map((score) => (
                      <RadioGroupToggle
                        key={score}
                        size="sm"
                        value={String(score)}
                        aria-label={t("score", { score, band: t(`bands.${bandOf(score)}`) })}
                      >
                        {score}
                      </RadioGroupToggle>
                    ))}
                  </RadioGroup>
                  {chosen && (
                    <span className="text-xs text-muted-foreground">
                      {t(`bands.${bandOf(Number(chosen))}`)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Field>
        <FieldLabel htmlFor="assessment-note">{t("note")}</FieldLabel>
        <Textarea
          id="assessment-note"
          value={note}
          maxLength={2000}
          disabled={released}
          onChange={(event) => setNote(event.target.value)}
        />
        <FieldDescription>{judge ? t("readByJudge") : t("readByOperator")}</FieldDescription>
      </Field>

      {!released && (
        <div className="flex flex-col gap-2">
          {unsaved && (
            <p role="status" className="text-xs text-muted-foreground">
              {t("unsaved")}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {nextHref && (
              <Button prominence="tertiary" href={nextHref}>
                {t("skip")}
              </Button>
            )}
            {/* Until every criterion is scored, the note keeps on its own. */}
            {!complete && (
              <Button
                prominence="secondary"
                pending={pending === "note"}
                disabled={note === (mine?.note ?? "") || pending !== null}
                onClick={() => save("note")}
              >
                {t("saveNote")}
              </Button>
            )}
            <Button
              className="flex-1"
              prominence={saveProminence}
              pending={pending === "save"}
              disabled={!complete || criteria.length === 0 || pending !== null}
              aria-describedby={complete ? undefined : "assessment-incomplete"}
              onClick={() => save("save")}
            >
              {nextHref ? t("saveAndNext") : t("save")}
            </Button>
          </div>
          {/* Why the save is held, beside it. Without criteria the panel says so above. */}
          {!complete && criteria.length > 0 && (
            <p id="assessment-incomplete" className="text-xs text-muted-foreground">
              {t("incomplete", { count: criteria.length - scored.length })}
            </p>
          )}
          {!mine?.conflict && (
            <Button
              className="h-auto min-h-8 py-1 whitespace-normal"
              prominence="tertiary"
              size="sm"
              pending={pending === "conflict"}
              disabled={pending !== null}
              onClick={() => save("conflict")}
            >
              {t("conflict")}
            </Button>
          )}
        </div>
      )}
      {/* Below 1024px the panel sits under the application: a bar keeps the scoring in reach. */}
      {!released && criteria.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t bg-background px-4 py-3 lg:hidden">
          <span className="flex-1 text-sm tabular-nums">
            {t("bar.progress", { scored: scored.length, total: criteria.length })}
          </span>
          {complete ? (
            <Button
              size="sm"
              prominence={saveProminence}
              pending={pending === "save"}
              onClick={() => save("save")}
            >
              {nextHref ? t("saveAndNext") : t("save")}
            </Button>
          ) : (
            <Button
              size="sm"
              prominence="secondary"
              onClick={() =>
                document.getElementById("assessment")?.scrollIntoView({ block: "start" })
              }
            >
              {t("bar.score")}
            </Button>
          )}
        </div>
      )}
      <LeaveGuard
        active={unsaved && pending === null}
        back
        title={t("leave.title")}
        description={t("leave.lead")}
        leaveLabel={t("leave.leave")}
        stayLabel={t("leave.stay")}
      />
    </section>
  );
}

export { AssessmentPanel };
