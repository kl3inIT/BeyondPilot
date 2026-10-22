import { UsersIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { DataTableEmpty } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { Person } from "@/components/composites/person";
import { Badge } from "@/components/ui/badge";
import type { ReviewCriteria, Reviewers } from "@/lib/api/generated";

import { ExportReviewers } from "./export-reviewers";
import { CriteriaEditor, InviteReviewer, ReviewerRowActions } from "./reviewer-actions";
import { sortReviewers, type ReviewersSearch } from "./reviewers-search";

type ReviewersPageProps = {
  programId: string;
  programName: string;
  reviewers: Reviewers;
  criteria: ReviewCriteria;
  /** The order of the judges, from the URL. */
  search: ReviewersSearch;
};

/**
 * The judges of a program with how many applications each has scored, the invitations still open,
 * and the criteria every judge scores on. Operators score every program without an invitation and
 * are listed once they have.
 */
function ReviewersPage({
  programId,
  programName,
  reviewers,
  criteria,
  search,
}: ReviewersPageProps) {
  const t = useTranslations("Review.reviewers");
  const c = useTranslations("Review.criteria");
  const locale = useLocale();
  const sorted = sortReviewers(reviewers.items, search);

  return (
    <div className="flex flex-col gap-6" lang={locale}>
      <section aria-labelledby="reviewers-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="flex flex-col gap-1">
            <h2 id="reviewers-title" className="text-lg font-semibold">
              {t("title")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("lead")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ExportReviewers programId={programId} disabled={reviewers.items.length === 0} />
            <InviteReviewer programId={programId} programName={programName} />
          </div>
        </div>
        {reviewers.items.length === 0 ? (
          <DataTableEmpty icon={<UsersIcon aria-hidden="true" />} title={t("empty.title")} />
        ) : (
          <DataTableRows
            sortKeys={sorted.sortKeys}
            defaultSort={sorted.defaultSort}
            columns={[
              { id: "reviewer", header: t("columns.reviewer"), layout: { fill: true } },
              { id: "role", header: t("columns.role") },
              { id: "status", header: t("columns.status") },
              {
                id: "assessed",
                header: t("columns.assessed"),
                layout: { nowrap: true, descFirst: true },
              },
              { id: "actions", header: <span className="sr-only">{t("columns.actions")}</span> },
            ]}
            rows={sorted.items.map((reviewer) => ({
              id: reviewer.id ?? reviewer.email,
              cells: {
                reviewer: <Person name={reviewer.name ?? null} email={reviewer.email} />,
                role: t(`role.${reviewer.role}`),
                status: (
                  <Badge
                    variant={
                      reviewer.status === "active"
                        ? "success"
                        : reviewer.status === "invited"
                          ? "outline"
                          : "warning"
                    }
                  >
                    {t(`status.${reviewer.status}`)}
                  </Badge>
                ),
                assessed: t("assessed", {
                  done: reviewer.assessed,
                  total: reviewers.applications,
                }),
                actions: reviewer.id && (
                  <ReviewerRowActions
                    programId={programId}
                    reviewerId={reviewer.id}
                    email={reviewer.email}
                    canResend={reviewer.status !== "active"}
                  />
                ),
              },
            }))}
          />
        )}
        <p className="text-sm text-muted-foreground">{t("note")}</p>
      </section>

      <section
        aria-labelledby="criteria-title"
        className="flex flex-col gap-3 rounded-lg border bg-card p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="flex flex-col gap-1">
            <h2 id="criteria-title" className="text-base font-semibold">
              {c("title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {criteria.fixed ? c("fixed") : c("lead")}
            </p>
          </div>
          {!criteria.fixed && <CriteriaEditor programId={programId} criteria={criteria.criteria} />}
        </div>
        {criteria.criteria.length === 0 ? (
          <p className="text-sm text-muted-foreground">{c("none")}</p>
        ) : (
          <ol className="flex flex-col divide-y">
            {criteria.criteria.map((criterion, index) => (
              <li key={criterion.id} className="flex gap-3 py-2.5 text-sm">
                <span className="w-5 text-muted-foreground tabular-nums">{index + 1}</span>
                <span className="flex flex-col">
                  <span>
                    {criterion.name}
                    {criterion.maxPoints != null && (
                      <span className="text-muted-foreground">
                        {" · "}
                        {c("upTo", { max: criterion.maxPoints })}
                      </span>
                    )}
                  </span>
                  {criterion.description && (
                    <span className="text-muted-foreground">{criterion.description}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

export { ReviewersPage };
