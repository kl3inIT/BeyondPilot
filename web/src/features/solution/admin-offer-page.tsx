import { BoxesIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { DataTableEmpty } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { ReviewStatus, reviewState } from "@/components/composites/review-status";
import { useFormatter } from "@/i18n/format";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { Link } from "@/i18n/navigation";
import { useVocabulary } from "@/i18n/vocabulary";
import type { AdminOfferDetail } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { CloseOffer } from "./offer-actions";
import { OfferAddress } from "./offer-address";
import { OfferState } from "./offer-state";

const link =
  "rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Admin › Offers › one offer: what it says and who wrote it, whether it is open to new solutions,
 * and the solutions that come with it, which keep it when it is closed.
 */
function AdminOfferPage({ detail }: { detail: AdminOfferDetail }) {
  const t = useTranslations("Admin.offers");
  const page = useTranslations("Admin.offers.detail");
  const list = useTranslations("Solution.offers.manage");
  const status = useVocabulary("reviewStatus");
  const format = useFormatter();
  const locale = useLocale();
  const { offer, solutionList } = detail;
  const day = (value: string) => format.dateTime(new Date(value), { dateStyle: "medium" });
  const facts = [
    [page("fields.writer"), offer.organizationName ?? t("genAiFund")],
    [page("fields.address"), <OfferAddress key="url" url={offer.url} />],
    [page("fields.created"), day(detail.createdAt)],
    [page("fields.updated"), day(offer.updatedAt)],
  ] as const;
  const empty =
    solutionList.length > 0 ? null : (
      <DataTableEmpty icon={<BoxesIcon aria-hidden="true" />} title={page("solutions.empty")} />
    );
  const review = (solution: AdminOfferDetail["solutionList"][number]) => {
    const state = reviewState(solution) as Parameters<typeof ReviewStatus>[0]["state"];
    return <ReviewStatus state={state}>{status(state)}</ReviewStatus>;
  };

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <AdminPageHeader
        back={{ href: siteRoutes.adminOffers, label: page("back") }}
        title={offer.title}
        badges={<OfferState closed={offer.closed} />}
        actions={<CloseOffer offer={offer} own={false} />}
      />

      {offer.closed && <p className="text-sm text-muted-foreground">{page("closedNote")}</p>}

      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map(([term, value]) => (
          <div key={term} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{term}</dt>
            <dd className="min-w-0 text-sm">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-3" aria-labelledby="offer-solutions">
        <h2 id="offer-solutions" className="text-base font-semibold">
          {page("solutions.title")}{" "}
          <span className="font-normal text-muted-foreground">
            {list("solutions", { count: solutionList.length })}
          </span>
        </h2>

        {/* From 768px: a table. */}
        <DataTableRows
          className="hidden md:flex"
          columns={[
            { id: "name", header: page("solutions.columns.solution"), layout: { fill: true } },
            { id: "organization", header: page("solutions.columns.organization") },
            { id: "status", header: page("solutions.columns.review") },
          ]}
          rows={solutionList.map((solution) => ({
            id: solution.id,
            cells: {
              name: (
                <Link
                  href={`${siteRoutes.adminSolutions}/${solution.id}`}
                  className={`truncate font-medium ${link}`}
                >
                  {solution.name}
                </Link>
              ),
              organization: (
                <Link
                  href={`${siteRoutes.adminOrganizations}/${solution.organizationId}`}
                  className={`truncate text-muted-foreground ${link}`}
                >
                  {solution.organizationName}
                </Link>
              ),
              status: review(solution),
            },
          }))}
          empty={empty}
        />

        {/* Below 768px: one stacked row per solution, never a table scrolled sideways. */}
        <ul className="overflow-hidden rounded-lg border md:hidden">
          {solutionList.map((solution) => (
            <li key={solution.id} className="flex flex-col gap-1 border-b p-3 last:border-b-0">
              <Link
                href={`${siteRoutes.adminSolutions}/${solution.id}`}
                className={`text-sm font-medium wrap-break-word ${link}`}
              >
                {solution.name}
              </Link>
              <span className="text-sm text-muted-foreground">{solution.organizationName}</span>
              <span>{review(solution)}</span>
            </li>
          ))}
          {empty && <li>{empty}</li>}
        </ul>
      </section>
    </div>
  );
}

export { AdminOfferPage };
