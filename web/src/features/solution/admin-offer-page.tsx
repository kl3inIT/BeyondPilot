import { BoxesIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { DataTableEmpty } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { DetailList } from "@/components/composites/detail-list";
import { ReviewStatus, reviewState } from "@/components/composites/review-status";
import { Status } from "@/components/composites/status";
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
 * Admin › AI solutions › Offers › one offer: what it says, the organization that gives it and whether GenAI Fund
 * arranged it, whether it is open to new solutions, and the solutions that come with it, which keep
 * it when it is closed.
 */
function AdminOfferPage({ detail }: { detail: AdminOfferDetail }) {
  const page = useTranslations("Admin.offers.detail");
  const list = useTranslations("Solution.offers.manage");
  const offers = useTranslations("Solution.offers");
  const status = useVocabulary("reviewStatus");
  const format = useFormatter();
  const locale = useLocale();
  const { offer, solutionList } = detail;
  const day = (value: string) => format.dateTime(new Date(value), { dateStyle: "medium" });
  const facts = [
    [page("fields.writer"), offer.organizationName],
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
        badges={
          <>
            <OfferState closed={offer.closed} />
            {offer.fromGenAiFund && <Status appearance="pill">{offers("fromGenAiFund")}</Status>}
          </>
        }
        actions={<CloseOffer offer={offer} own={false} />}
      />

      <DetailList
        columns={4}
        details={facts.map(([term, value]) => ({ key: term, label: term, value }))}
      />

      <section className="flex flex-col gap-3" aria-labelledby="offer-solutions">
        <h2 id="offer-solutions" className="text-base font-semibold">
          {page("solutions.title")}{" "}
          <span className="font-normal text-muted-foreground">
            {list("solutions", { count: solutionList.length })}
          </span>
        </h2>

        <DataTableRows
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
      </section>
    </div>
  );
}

export { AdminOfferPage };
