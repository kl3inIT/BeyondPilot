"use client";

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

const SCORES = ["1", "2", "3", "4", "5"] as const;

type AssessmentPanelProps = {
  applicationId: string;
  criteria: ReviewCriterion[];
  mine: Assessment | null;
  /** The version of the application on show; an assessment of an earlier one says so. */
  version: number;
  /** Whether the caller is a judge rather than GenAI Fund staff: the note says who reads it. */
  judge: boolean;
  /** Scores no longer change once the outcomes are released. */
  released: boolean;
  /** The next application of the program, which Skip and a save lead to. */
  nextHref: string | null;
};

/**
 * The caller's assessment of an application: each criterion scored from 1 to 5 and a private note,
 * or a conflict of interest that leaves their score out. It changes until the outcomes are released.
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
  const [pending, setPending] = useState<"save" | "conflict" | null>(null);
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
  const average =
    scored.length === criteria.length && scored.length > 0
      ? scored.reduce((a, b) => a + b, 0) / scored.length
      : null;

  async function save(conflict: boolean) {
    setPending(conflict ? "conflict" : "save");
    try {
      await saveAssessment({
        path: { id: applicationId },
        body: {
          scores: conflict
            ? {}
            : Object.fromEntries(Object.entries(scores).map(([id, score]) => [id, Number(score)])),
          note: note.trim() === "" ? null : note,
          conflict,
        },
      });
      notify.success(conflict ? "Review.assessment.conflictSaved" : "Review.assessment.saved");
      if (nextHref && !conflict) {
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
          className="flex min-w-0 flex-col gap-2.5"
        >
          {/* How far the scoring is, at every width: the bar of a narrow screen only repeats it. */}
          <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm font-medium">
            <span id="assessment-criteria">{t("criteria")}</span>
            <span className="flex gap-2 tabular-nums">
              <span className={complete ? "text-muted-foreground" : undefined}>
                {t("bar.progress", { scored: scored.length, total: criteria.length })}
              </span>
              {average !== null && (
                <span className="text-primary">{t("average", { value: average.toFixed(1) })}</span>
              )}
            </span>
          </div>
          {criteria.map((criterion) => (
            // In a narrow panel the scale goes under the name of its criterion.
            <div
              key={criterion.id}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5"
            >
              <span className="flex min-w-0 flex-col text-sm">
                <span id={`criterion-${criterion.id}`}>{criterion.name}</span>
                {criterion.description && (
                  <span id={`criterion-${criterion.id}-what`} className="text-muted-foreground">
                    {criterion.description}
                  </span>
                )}
              </span>
              {/* One score of five: a radio group, so the arrow keys move along the scale. */}
              <RadioGroup
                className="flex w-fit"
                aria-labelledby={`criterion-${criterion.id}`}
                aria-describedby={
                  criterion.description ? `criterion-${criterion.id}-what` : undefined
                }
                disabled={released}
                value={scores[criterion.id] ?? ""}
                onValueChange={(value) =>
                  setScores((current) => ({ ...current, [criterion.id]: String(value) }))
                }
              >
                {SCORES.map((score) => (
                  <RadioGroupToggle
                    key={score}
                    size="sm"
                    value={score}
                    aria-label={t("score", { score })}
                  >
                    {score}
                  </RadioGroupToggle>
                ))}
              </RadioGroup>
            </div>
          ))}
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
            <Button
              className="flex-1"
              prominence="secondary"
              pending={pending === "save"}
              disabled={!complete || criteria.length === 0 || pending !== null}
              aria-describedby={complete ? undefined : "assessment-incomplete"}
              onClick={() => save(false)}
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
              onClick={() => save(true)}
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
            <Button size="sm" pending={pending === "save"} onClick={() => save(false)}>
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
