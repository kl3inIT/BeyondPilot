"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useNotify } from "@/hooks/use-notify";
import { getPathname } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/client";
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
        router.push(getPathname({ href: nextHref, locale }));
      } else {
        router.refresh();
      }
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      notify.error(
        code === "PROPOSAL_RELEASED" ||
          code === "PROPOSAL_NO_CRITERIA" ||
          code === "PROPOSAL_ASSESSMENT_INVALID"
          ? `Review.errors.${code}`
          : "Review.errors.unknown",
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <section
      aria-labelledby="assessment-title"
      className="flex flex-col gap-4 rounded-lg border bg-card p-5"
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
        <fieldset className="flex min-w-0 flex-col gap-2.5" disabled={released}>
          <legend className="mb-1 flex w-full items-center justify-between gap-3 text-sm font-medium">
            <span>{t("criteria")}</span>
            <span className="text-primary tabular-nums">
              {average === null ? t("notScored") : t("average", { value: average.toFixed(1) })}
            </span>
          </legend>
          {criteria.map((criterion) => (
            // In a narrow panel the scale goes under the name of its criterion.
            <div
              key={criterion.id}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5"
            >
              <span className="min-w-0 text-sm" title={criterion.description ?? undefined}>
                {criterion.name}
              </span>
              <ToggleGroup
                variant="rating"
                size="sm"
                spacing={1}
                aria-label={criterion.name}
                value={scores[criterion.id] ? [scores[criterion.id]] : []}
                onValueChange={(values) =>
                  setScores((current) => ({ ...current, [criterion.id]: values.at(-1) ?? "" }))
                }
              >
                {SCORES.map((score) => (
                  <ToggleGroupItem key={score} value={score} aria-label={t("score", { score })}>
                    {score}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          ))}
        </fieldset>
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
              onClick={() => save(false)}
            >
              {nextHref ? t("saveAndNext") : t("save")}
            </Button>
          </div>
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
    </section>
  );
}

export { AssessmentPanel };
