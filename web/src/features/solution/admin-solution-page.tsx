import { ArrowLeftIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { QueueNext } from "@/components/composites/queue-next";
import { ReviewStatus } from "@/components/composites/review-status";
import { useVocabulary } from "@/i18n/vocabulary";
import type { Solution } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { CustomerDeploymentsReview } from "./customer-deployments-review";
import { SolutionRecord } from "./solution-record";
import { SolutionReview } from "./solution-review";

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
  const deploymentsWaiting = solution.customerDeployments.filter(
    (item) => item.status === "submitted",
  ).length;

  const facts: { label: string; value: React.ReactNode }[] = [
    {
      label: t("status"),
      value: <ReviewStatus state={solution.status}>{status(solution.status)}</ReviewStatus>,
    },
    {
      label: t("organization"),
      value: (
        <TextButton href={`${siteRoutes.adminOrganizations}/${solution.organizationId}`}>
          {solution.organizationName}
        </TextButton>
      ),
    },
    // A solution sent before the sender was recorded says so, rather than showing nothing.
    { label: t("sentBy"), value: solution.submittedBy ?? t("senderUnknown") },
    ...(solution.submittedAt
      ? [
          {
            label: t("sent"),
            value:
              solution.status === "submitted"
                ? t("waitingSince", { time: format.relativeTime(new Date(solution.submittedAt)) })
                : t("submitted", {
                    day: format.dateTime(new Date(solution.submittedAt), { dateStyle: "medium" }),
                  }),
          },
        ]
      : []),
    {
      label: t("directory"),
      value:
        solution.status === "approved" && solution.listed ? (
          <TextButton href={`${siteRoutes.solutions}/${solution.slug}`}>{t("public")}</TextButton>
        ) : (
          t(solution.listed ? "listed" : "unlisted")
        ),
    },
  ];

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
      <h1 className="text-2xl font-semibold tracking-tight">{solution.name}</h1>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        {/* The decision: first on a narrow screen, beside the record and in view while it scrolls on a wide one. */}
        <aside
          aria-labelledby="solution-decision"
          className="flex flex-col gap-4 rounded-lg border bg-card p-5 lg:sticky lg:top-4 lg:order-2"
        >
          <h2 id="solution-decision" className="text-base font-semibold">
            {t("decision")}
          </h2>
          <dl className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
            {facts.map((fact) => (
              <div key={fact.label} className="contents">
                <dt className="text-muted-foreground">{fact.label}</dt>
                <dd className="col-span-2 min-w-0 break-words">{fact.value}</dd>
              </div>
            ))}
          </dl>

          {solution.status === "rejected" && (
            <p className="rounded-lg border bg-muted p-3 text-sm">
              <span className="font-medium">
                {t("rejected", { reason: reason(solution.decisionReason ?? "other") })}
              </span>
              {solution.decisionMessage && <> {solution.decisionMessage}</>}
            </p>
          )}
          {/* Approving the solution does not decide on what its owners claim about customers. */}
          {deploymentsWaiting > 0 && (
            <p className="text-sm">
              <TextButton href="#customer-deployments">
                {t("deploymentsWaiting", { count: deploymentsWaiting })}
              </TextButton>
            </p>
          )}
          {(solution.status === "submitted" || solution.status === "approved") && (
            <SolutionReview
              key={solution.id}
              solution={solution}
              nextHref={next?.href ?? `${siteRoutes.adminSolutions}?status=submitted`}
            />
          )}
        </aside>

        <div className="flex min-w-0 flex-col gap-6 lg:order-1 lg:col-span-2">
          <SolutionRecord solution={solution} />
          <div id="customer-deployments" className="scroll-mt-4">
            <CustomerDeploymentsReview deployments={solution.customerDeployments} />
          </div>
        </div>
      </div>
    </div>
  );
}

export { AdminSolutionPage };
