import { ArrowLeftIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { TextButton } from "@/components/actions/text-button";
import { QueueNext } from "@/components/composites/queue-next";
import { Badge } from "@/components/ui/badge";
import { applyFormatter } from "@/features/apply/apply-format";
import type { ReviewApplication } from "@/lib/api/generated";

import { AssessmentPanel } from "./assessment-panel";
import { DecisionPanel } from "./decision-panel";
import { SubmittedRecord } from "./submitted-record";

type ReviewApplicationPageProps = {
  review: ReviewApplication;
  /** The list this application belongs to; the others open under it. */
  base: string;
};

/**
 * One application under review: what its applicant submitted last, beside the caller's assessment.
 * An operator also reads every judge's score and the history, and decides.
 */
async function ReviewApplicationPage({ review, base }: ReviewApplicationPageProps) {
  const [t, locale] = await Promise.all([getTranslations("Review.application"), getLocale()]);
  const format = applyFormatter(locale);
  const { head, submitted } = review;
  const released = Boolean(head.releasedAt);
  const nextHref = review.nextId ? `${base}/${review.nextId}` : null;

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <TextButton href={base}>
          <ArrowLeftIcon aria-hidden="true" />
          {t("back", { program: head.name })}
        </TextButton>
        <QueueNext
          position={t("position", { place: review.position, total: review.total })}
          next={nextHref ? { href: nextHref, label: t("next") } : null}
        />
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{submitted.solutionName}</h1>
          {head.operator && review.reviewStatus && (
            <Badge
              variant={
                review.reviewStatus === "shortlisted"
                  ? "success"
                  : review.reviewStatus === "not_selected"
                    ? "outline"
                    : "warning"
              }
            >
              {t(`decision.${review.reviewStatus}`)}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {t("meta", {
            organization: submitted.organizationName,
            submitted: format.moment(review.submittedAt),
            version: review.version,
          })}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:order-2">
          <AssessmentPanel
            key={`${review.id}-${review.mine?.savedAt ?? "none"}`}
            applicationId={review.id}
            criteria={head.criteria}
            mine={review.mine ?? null}
            version={review.version}
            judge={!head.operator}
            released={released}
            nextHref={nextHref}
          />
          {head.operator && (
            <section
              aria-labelledby="scores-title"
              className="flex flex-col gap-3 rounded-lg border bg-card p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 id="scores-title" className="text-base font-semibold">
                  {t("scores.title")}
                </h2>
                {review.average != null && (
                  <span className="text-sm font-medium tabular-nums">
                    {t("scores.average", { value: review.average.toFixed(1) })}
                  </span>
                )}
              </div>
              {review.others.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("scores.none")}</p>
              ) : (
                <ul className="flex flex-col divide-y">
                  {review.others.map((other) => (
                    <li
                      key={`${other.reviewer}-${other.savedAt}`}
                      className="flex flex-col gap-1 py-2.5 text-sm"
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="font-medium">{other.reviewer}</span>
                        <span className="tabular-nums">
                          {other.conflict
                            ? t("scores.conflict")
                            : t("scores.average", { value: (other.average ?? 0).toFixed(1) })}
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        {[
                          t(`scores.role.${other.role}`),
                          format.moment(other.savedAt),
                          other.version < review.version
                            ? t("scores.onVersion", { version: other.version })
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      {!other.conflict && (
                        <span className="text-muted-foreground">
                          {/* In the order the program lists its criteria. */}
                          {head.criteria
                            .filter((criterion) => other.scores[criterion.id] !== undefined)
                            .map((criterion) => `${criterion.name} ${other.scores[criterion.id]}`)
                            .join(" · ")}
                        </span>
                      )}
                      {other.note && <span className="whitespace-pre-line">{other.note}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {head.operator && (
            <DecisionPanel
              key={`${review.id}-${review.reviewStatus}`}
              programId={head.programId}
              applicationId={review.id}
              decision={review.reviewStatus ?? "under_review"}
              released={released}
              nextHref={nextHref}
            />
          )}
          <section
            aria-labelledby="history-title"
            className="flex flex-col gap-3 rounded-lg border bg-card p-5"
          >
            <h2 id="history-title" className="text-base font-semibold">
              {t("history.title")}
            </h2>
            <ol className="flex flex-col gap-2.5 text-sm">
              {review.history.map((event) => (
                <li key={`${event.kind}-${event.at}`} className="flex flex-col">
                  <span className="font-medium">
                    {event.kind === "submitted"
                      ? t("history.submitted", { version: event.version ?? 1 })
                      : t(`history.decided.${event.decision ?? "under_review"}`)}
                  </span>
                  <span className="text-muted-foreground">
                    {[format.moment(event.at), event.by].filter(Boolean).join(" · ")}
                  </span>
                  {event.reason && <span className="text-muted-foreground">{event.reason}</span>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="min-w-0 lg:order-1 lg:col-span-2">
          <SubmittedRecord applicationId={review.id} submitted={submitted} />
        </div>
      </div>
    </div>
  );
}

export { ReviewApplicationPage };
