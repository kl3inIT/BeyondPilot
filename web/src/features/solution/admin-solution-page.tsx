import { ArrowLeftIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { QueueNext } from "@/components/composites/queue-next";
import { ReviewStatus } from "@/components/composites/review-status";
import { useVocabulary } from "@/i18n/vocabulary";
import type { Solution } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { CustomerDeploymentsReview } from "./customer-deployments-review";
import { SolutionReview } from "./solution-review";
import { SolutionView } from "./solution-view";

/** Admin › Solutions › one solution: what its organization wrote, and the decision. */
type AdminSolutionPageProps = {
  solution: Solution;
  /** The next record that waits for a decision, if another does. */
  next: { href: string; name: string } | null;
  /** Where this record stands among those that wait, and how many do. */
  queue: { place: number | null; total: number };
};

function AdminSolutionPage({ solution, next, queue }: AdminSolutionPageProps) {
  const t = useTranslations("Admin.solutions.detail");
  const status = useVocabulary("reviewStatus");
  const reason = useVocabulary("solutionRejection");
  const format = useFormatter();
  const locale = useLocale();

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <TextButton href={siteRoutes.adminSolutions}>
          <ArrowLeftIcon aria-hidden="true" />
          {t("back")}
        </TextButton>
        <QueueNext
          position={
            queue.place === null
              ? undefined
              : t("position", { place: queue.place, total: queue.total })
          }
          next={next && { href: next.href, label: t("next", { name: next.name }) }}
        />
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{solution.name}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <ReviewStatus state={solution.status}>{status(solution.status)}</ReviewStatus>
            <TextButton href={`${siteRoutes.adminOrganizations}/${solution.organizationId}`}>
              {solution.organizationName}
            </TextButton>
            {solution.submittedAt && (
              <span>
                {solution.status === "submitted"
                  ? t("waitingSince", { time: format.relativeTime(new Date(solution.submittedAt)) })
                  : t("submitted", {
                      day: format.dateTime(new Date(solution.submittedAt), { dateStyle: "medium" }),
                    })}
              </span>
            )}
            {!solution.listed && <span>{t("unlisted")}</span>}
            {solution.status === "approved" && solution.listed && (
              <TextButton href={`${siteRoutes.solutions}/${solution.slug}`}>
                {t("public")}
              </TextButton>
            )}
          </div>
        </div>
        {(solution.status === "submitted" || solution.status === "approved") && (
          <SolutionReview
            key={solution.id}
            solution={solution}
            nextHref={next?.href ?? `${siteRoutes.adminSolutions}?status=submitted`}
          />
        )}
      </div>

      {solution.status === "rejected" && (
        <p className="rounded-lg border bg-muted p-3 text-sm">
          <span className="font-medium">
            {t("rejected", { reason: reason(solution.decisionReason ?? "other") })}
          </span>
          {solution.decisionMessage && <> {solution.decisionMessage}</>}
        </p>
      )}

      <SolutionView solution={solution} />
      <CustomerDeploymentsReview deployments={solution.customerDeployments} />
    </div>
  );
}

export { AdminSolutionPage };
