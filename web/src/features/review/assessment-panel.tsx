"use client";

import { cn } from "cn";
import { BookmarkIcon, CheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { LeaveGuard, onGuardEntry } from "@/components/composites/leave-guard";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
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
            <Progress
              value={criteria.length === 0 ? 0 : (scored.length / criteria.length) * 100}
              aria-hidden="true"
            />
            <p id="assessment-scale" className="text-xs text-muted-foreground">
              {t("scale")}
            </p>
          </div>
          {/* One block a criterion, divided, so a judge sees where each starts and which are left (Minh, BEY-223). */}
          <ol className="flex flex-col divide-y">
            {criteria.map((criterion, index) => {
              const chosen = scores[criterion.id];
              return (
                <li
                  key={criterion.id}
                  className="@container flex flex-col gap-2 py-3.5 first:pt-0 last:pb-0"
                >
                  <div className="flex items-start gap-2 text-sm">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-px flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
                        chosen
                          ? "border-success bg-success text-success-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {chosen ? <CheckIcon className="size-3" /> : index + 1}
                    </span>
                    <span id={`criterion-${criterion.id}`} className="min-w-0 flex-1 font-semibold">
                      {criterion.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {chosen ? (
                        <span className="font-medium text-foreground">
                          {chosen} · <span>{t(`bands.${bandOf(Number(chosen))}`)}</span>
                        </span>
                      ) : (
                        <>
                          <span aria-hidden="true">—</span>
                          <span className="sr-only">{t("notScored")}</span>
                        </>
                      )}
                    </span>
                  </div>
                  {criterion.description && (
                    <CriterionDescription
                      id={`criterion-${criterion.id}-what`}
                      text={criterion.description}
                    />
                  )}
                  {/* One score of ten, on one row where it fits and two even rows of five where not: a radio group, so the arrow keys move along the scale. */}
                  <RadioGroup
                    className="grid-cols-5 @sm:grid-cols-10"
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
                        className="w-full"
                        value={String(score)}
                        aria-label={t("score", { score, band: t(`bands.${bandOf(score)}`) })}
                      >
                        {score}
                      </RadioGroupToggle>
                    ))}
                  </RadioGroup>
                </li>
              );
            })}
          </ol>
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

/**
 * What a judge looks for in a criterion, cut to two lines with More to read the rest. More shows
 * only when the text runs longer than the two lines.
 */
function CriterionDescription({ id, text }: { id: string; text: string }) {
  const t = useTranslations("Review.assessment");
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || open) {
      return;
    }
    const measure = () => setLong(element.scrollHeight > element.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [open, text]);

  return (
    <div className="flex flex-col items-start gap-0.5">
      <p ref={ref} id={id} className={cn("text-xs text-muted-foreground", !open && "line-clamp-2")}>
        {text}
      </p>
      {(long || open) && (
        <TextButton size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? t("less") : t("more")}
        </TextButton>
      )}
    </div>
  );
}

export { AssessmentPanel };
