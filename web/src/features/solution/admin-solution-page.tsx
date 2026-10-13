import { useLocale, useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { DetailList } from "@/components/composites/detail-list";
import { FeaturedBadge } from "@/components/composites/featured-badge";
import { QueueNext } from "@/components/composites/queue-next";
import { ReviewStatus, reviewState } from "@/components/composites/review-status";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { useFormatter } from "@/i18n/format";
import { useVocabulary } from "@/i18n/vocabulary";
import type { Solution } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { CustomerDeploymentsReview } from "./customer-deployments-review";
import { SolutionBacking } from "./solution-backing";
import { SolutionFeature } from "./solution-feature";
import { SolutionOffersChoice } from "./solution-offers-choice";
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
  const feature = useTranslations("Admin.solutions.feature");
  const status = useVocabulary("reviewStatus");
  const reason = useVocabulary("solutionRejection");
  const takedown = useVocabulary("solutionTakedown");
  const state = reviewState(solution);
  const format = useFormatter();
  const locale = useLocale();
  const deploymentsWaiting = solution.customerDeployments.filter(
    (item) => item.status === "in_review",
  ).length;

  const facts: { label: string; value: React.ReactNode }[] = [
    {
      label: t("status"),
      value: <ReviewStatus state={state}>{status(state)}</ReviewStatus>,
    },
    {
      label: t("organization"),
      value: (
        <TextButton
          href={`${siteRoutes.adminOrganizations}/${solution.organizationId}`}
          className="text-left whitespace-normal"
        >
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
              solution.status === "in_review"
                ? t("waitingSince", { time: format.relativeTime(new Date(solution.submittedAt)) })
                : t("submitted", {
                    day: format.dateTime(new Date(solution.submittedAt), "date"),
                  }),
          },
        ]
      : []),
    {
      label: t("directory"),
      value:
        state === "approved" && solution.listed ? (
          <TextButton href={`${siteRoutes.solutions}/${solution.slug}`}>{t("public")}</TextButton>
        ) : (
          t(solution.listed ? "listed" : "unlisted")
        ),
    },
    ...(solution.featuredAt
      ? [
          {
            label: t("order"),
            value: (
              <FeaturedBadge>
                {feature("since", {
                  day: format.dateTime(new Date(solution.featuredAt), "date"),
                })}
              </FeaturedBadge>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <AdminPageHeader
        back={{ href: siteRoutes.adminSolutions, label: t("back") }}
        title={solution.name}
        actions={
          <QueueNext
            position={
              queue.place === null
                ? undefined
                : t("position", { place: queue.place, total: queue.total })
            }
            next={next && { href: next.href, label: t("next", { name: next.name }) }}
          />
        }
      />

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        {/* The decision: first on a narrow screen, beside the record and in view while it scrolls on a wide one. */}
        <div className="flex flex-col gap-6 lg:sticky lg:top-4 lg:order-2">
          <aside
            aria-labelledby="solution-decision"
            className="flex flex-col gap-4 rounded-lg border bg-card p-5"
          >
            <h2 id="solution-decision" className="text-base font-semibold">
              {t("decision")}
            </h2>
            <DetailList
              layout="rows"
              details={facts.map((fact) => ({ key: fact.label, ...fact }))}
            />

            {solution.status === "rejected" && (
              <p className="rounded-lg border bg-muted p-3 text-sm">
                <span className="font-medium">
                  {t("rejected", { reason: reason(solution.decisionReason ?? "other") })}
                </span>
                {solution.decisionMessage && <> {solution.decisionMessage}</>}
              </p>
            )}
            {solution.status === "needs_changes" && solution.decisionMessage && (
              <p className="rounded-lg border bg-muted p-3 text-sm">
                <span className="font-medium">{t("sentBack")}</span> {solution.decisionMessage}
              </p>
            )}
            {state === "suspended" && (
              <p className="rounded-lg border bg-muted p-3 text-sm">
                <span className="font-medium">
                  {t("takenDown", { reason: takedown(solution.suspensionReason ?? "other") })}
                </span>
                {solution.suspensionMessage && <> {solution.suspensionMessage}</>}
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
            {(state === "in_review" || state === "approved" || state === "suspended") && (
              <SolutionReview
                key={solution.id}
                solution={solution}
                nextHref={next?.href ?? `${siteRoutes.adminSolutions}?status=in_review`}
              />
            )}
            <div className="border-t pt-4">
              <SolutionFeature key={solution.id} solution={solution} appearance="button" />
            </div>
          </aside>
          <SolutionBacking key={solution.id} solution={solution} />
          <SolutionOffersChoice key={`${solution.id}-offers`} solution={solution} />
        </div>

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
