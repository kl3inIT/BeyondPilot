import { UsersIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { DataTable, DataTableEmpty } from "@/components/composites/data-table";
import { Person } from "@/components/composites/person";
import { Badge } from "@/components/ui/badge";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ReviewCriteria, Reviewers } from "@/lib/api/generated";

import { CriteriaEditor, InviteReviewer, ReviewerRowActions } from "./reviewer-actions";

type ReviewersPageProps = {
  programId: string;
  programName: string;
  reviewers: Reviewers;
  criteria: ReviewCriteria;
};

/**
 * The judges of a program with how many applications each has scored, the invitations still open,
 * and the criteria every judge scores on. Operators score every program without an invitation and
 * are listed once they have.
 */
function ReviewersPage({ programId, programName, reviewers, criteria }: ReviewersPageProps) {
  const t = useTranslations("Review.reviewers");
  const c = useTranslations("Review.criteria");
  const locale = useLocale();

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
          <InviteReviewer programId={programId} programName={programName} />
        </div>
        {reviewers.items.length === 0 ? (
          <DataTableEmpty
            icon={<UsersIcon aria-hidden="true" />}
            title={t("empty.title")}
            description={t("empty.description")}
          />
        ) : (
          <DataTable>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.reviewer")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("columns.role")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("columns.assessed")}</TableHead>
                <TableHead>
                  <span className="sr-only">{t("columns.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviewers.items.map((reviewer) => (
                <TableRow key={reviewer.id ?? reviewer.email}>
                  <TableCell className="w-full max-w-0">
                    <Person name={reviewer.name ?? null} email={reviewer.email} />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {t(`role.${reviewer.role}`)}
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap sm:table-cell">
                    {t("assessed", { done: reviewer.assessed, total: reviewers.applications })}
                  </TableCell>
                  <TableCell>
                    {reviewer.id && (
                      <ReviewerRowActions
                        programId={programId}
                        reviewerId={reviewer.id}
                        email={reviewer.email}
                        canResend={reviewer.status !== "active"}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
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
                  <span>{criterion.name}</span>
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
