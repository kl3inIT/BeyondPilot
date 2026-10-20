import { GiftIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { DataTableEmpty } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { Link } from "@/i18n/navigation";
import type { AdminOffer } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { CreateOffer, OfferRowMenu } from "./offer-actions";
import { OfferAddress } from "./offer-address";
import { OfferState } from "./offer-state";
import { OfferTitle } from "./solution-offers";

/**
 * The Offers tab of an organization's record in Admin: what the organization gives with its
 * solutions, which only its solutions come with. An operator writes them here for an organization
 * nobody signed in for, such as a partner's credits GenAI Fund arranged, and changes, closes and
 * deletes them as on AI solutions › Offers.
 */
function AdminOrganizationOffers({
  organizationId,
  offers,
}: {
  organizationId: string;
  offers: AdminOffer[];
}) {
  const t = useTranslations("Admin.offers");
  const list = useTranslations("Solution.offers.manage");

  return (
    <section aria-labelledby="organization-offers" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="organization-offers" className="text-lg font-semibold">
          {list("title")}
        </h2>
        <CreateOffer organizationId={organizationId} />
      </div>
      <DataTableRows
        columns={[
          { id: "title", header: list("columns.offer"), layout: { fill: true } },
          { id: "state", header: t("columns.state") },
          { id: "url", header: list("columns.url"), layout: { from: "lg", width: "lg" } },
          { id: "solutions", header: list("columns.solutions"), layout: { numeric: true } },
          {
            id: "actions",
            header: <span className="sr-only">{list("columns.actions")}</span>,
            layout: { width: "action" },
          },
        ]}
        rows={offers.map((offer) => ({
          id: offer.id,
          cells: {
            title: (
              <Link
                href={`${siteRoutes.adminOffers}/${offer.id}`}
                className="block truncate rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <OfferTitle offer={offer} />
              </Link>
            ),
            state: <OfferState closed={offer.closed} />,
            url: (
              <div className="w-56">
                <OfferAddress url={offer.url} />
              </div>
            ),
            solutions: offer.solutions,
            actions: (
              <div className="flex justify-end">
                <OfferRowMenu offer={offer} />
              </div>
            ),
          },
        }))}
        empty={
          offers.length > 0 ? null : (
            <DataTableEmpty
              icon={<GiftIcon aria-hidden="true" />}
              title={list("empty.title")}
              description={t("organizationEmpty")}
            />
          )
        }
      />
    </section>
  );
}

export { AdminOrganizationOffers };
