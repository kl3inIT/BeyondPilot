import { ArrowLeftIcon, ArrowRightIcon, BoxesIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { ReviewStatus } from "@/components/composites/review-status";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { AdminOrganizationTabs } from "@/features/organization/admin-organization-tabs";
import { Link } from "@/i18n/navigation";
import { useVocabulary } from "@/i18n/vocabulary";
import type { AdminOrganization, AdminSolutionList, Solution } from "@/lib/api/generated";
import { adminOrganizationSolutionsRoute, siteRoutes } from "@/lib/site";

import { CustomerDeploymentsReview } from "./customer-deployments-review";
import { SolutionRecord } from "./solution-record";
import { SolutionReview } from "./solution-review";

type AdminOrganizationSolutionsPageProps = {
  detail: AdminOrganization;
  /** The solutions this organization has sent for review, those that wait first. */
  solutions: AdminSolutionList;
  /** The solution open beside the list; `null` when the organization has sent none. */
  selected: Solution | null;
};

/**
 * Admin › Organisations › one organization › Solutions: everything the organization has sent for
 * review in one list, and the one that is open beside it with its record, its customer deployments
 * and the decision. An operator walks an organization's solutions without leaving its record.
 */
function AdminOrganizationSolutionsPage({
  detail,
  solutions,
  selected,
}: AdminOrganizationSolutionsPageProps) {
  const t = useTranslations("Admin.solutions.ofOrganization");
  const d = useTranslations("Admin.solutions.detail");
  const list = useTranslations("Admin.solutions");
  const o = useTranslations("Admin.organizations.detail");
  const s = useTranslations("Organization.status");
  const status = useVocabulary("reviewStatus");
  const reason = useVocabulary("solutionRejection");
  const format = useFormatter();
  const locale = useLocale();
  const { organization } = detail;

  const waiting = solutions.items.filter((item) => item.status === "submitted");
  const deploymentsWaiting = solutions.items.reduce(
    (sum, item) => sum + item.deploymentsAwaitingReview,
    0,
  );
  // A decision on a waiting record opens the next one of this organization that waits.
  const next = waiting.find((item) => item.id !== selected?.id);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <div>
        <TextButton href={siteRoutes.adminOrganizations}>
          <ArrowLeftIcon aria-hidden="true" />
          {o("back")}
        </TextButton>
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{organization.name}</h1>
        <ReviewStatus state={organization.status}>{s(organization.status)}</ReviewStatus>
      </div>
      <AdminOrganizationTabs id={organization.id} current="solutions" solutions={solutions.total} />

      {solutions.items.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BoxesIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("none.title")}</EmptyTitle>
            <EmptyDescription>{t("none.description")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <p className="text-sm">
            {waiting.length === 0 && deploymentsWaiting === 0
              ? t("nothingWaits")
              : [
                  waiting.length > 0 && t("waiting", { count: waiting.length }),
                  deploymentsWaiting > 0 && t("deploymentsWaiting", { count: deploymentsWaiting }),
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </p>

          <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
            <nav aria-label={t("list")}>
              <ul className="overflow-hidden rounded-lg border">
                {solutions.items.map((item) => (
                  <li key={item.id} className="border-b last:border-b-0">
                    <Link
                      href={adminOrganizationSolutionsRoute(organization.id, item.id)}
                      scroll={false}
                      aria-current={item.id === selected?.id ? "true" : undefined}
                      className="flex flex-col gap-1 p-3 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset aria-[current=true]:bg-accent"
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-medium">{item.name}</span>
                        <span className="shrink-0 text-xs">
                          <ReviewStatus state={item.status}>{status(item.status)}</ReviewStatus>
                        </span>
                      </span>
                      {item.summary && (
                        <span className="truncate text-sm text-muted-foreground">
                          {item.summary}
                        </span>
                      )}
                      {item.deploymentsAwaitingReview > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {list("deploymentsWaiting", { count: item.deploymentsAwaitingReview })}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {selected && (
              <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                <section
                  aria-labelledby="open-solution"
                  className="flex flex-col gap-4 rounded-lg border bg-card p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                    <h2 id="open-solution" className="text-xl font-semibold tracking-tight">
                      {selected.name}
                    </h2>
                    <TextButton href={`${siteRoutes.adminSolutions}/${selected.id}`}>
                      {t("fullRecord")}
                      <ArrowRightIcon aria-hidden="true" />
                    </TextButton>
                  </div>
                  <dl className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                    <dt className="text-muted-foreground">{d("status")}</dt>
                    <dd className="col-span-2 sm:col-span-3">
                      <ReviewStatus state={selected.status}>{status(selected.status)}</ReviewStatus>
                    </dd>
                    <dt className="text-muted-foreground">{d("sentBy")}</dt>
                    <dd className="col-span-2 min-w-0 break-words sm:col-span-3">
                      {selected.submittedBy ?? d("senderUnknown")}
                    </dd>
                    {selected.submittedAt && (
                      <>
                        <dt className="text-muted-foreground">{d("sent")}</dt>
                        <dd className="col-span-2 sm:col-span-3">
                          {selected.status === "submitted"
                            ? d("waitingSince", {
                                time: format.relativeTime(new Date(selected.submittedAt)),
                              })
                            : d("submitted", {
                                day: format.dateTime(new Date(selected.submittedAt), {
                                  dateStyle: "medium",
                                }),
                              })}
                        </dd>
                      </>
                    )}
                    <dt className="text-muted-foreground">{d("directory")}</dt>
                    <dd className="col-span-2 sm:col-span-3">
                      {selected.status === "approved" && selected.listed ? (
                        <TextButton href={`${siteRoutes.solutions}/${selected.slug}`}>
                          {d("public")}
                        </TextButton>
                      ) : (
                        d(selected.listed ? "listed" : "unlisted")
                      )}
                    </dd>
                  </dl>
                  {selected.status === "rejected" && (
                    <p className="rounded-lg border bg-muted p-3 text-sm">
                      <span className="font-medium">
                        {d("rejected", { reason: reason(selected.decisionReason ?? "other") })}
                      </span>
                      {selected.decisionMessage && <> {selected.decisionMessage}</>}
                    </p>
                  )}
                  {(selected.status === "submitted" || selected.status === "approved") && (
                    <div className="max-w-sm">
                      <SolutionReview
                        key={selected.id}
                        solution={selected}
                        nextHref={next && adminOrganizationSolutionsRoute(organization.id, next.id)}
                      />
                    </div>
                  )}
                </section>
                <SolutionRecord solution={selected} />
                <CustomerDeploymentsReview deployments={selected.customerDeployments} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export { AdminOrganizationSolutionsPage };
