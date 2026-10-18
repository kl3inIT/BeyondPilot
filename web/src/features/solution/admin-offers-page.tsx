import { GiftIcon, SearchXIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { DataTableEmpty } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { Link } from "@/i18n/navigation";
import type { AdminOffer } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { OfferRowMenu } from "./offer-actions";
import { OfferAddress } from "./offer-address";
import { OfferState } from "./offer-state";
import { OfferTitle } from "./solution-offers";
import type { AdminOffersSearch } from "./offers-search";
import { OffersToolbar } from "./offers-toolbar";

/** The offers the search and the state filter leave, in the order they came. */
function matching(offers: AdminOffer[], { q, state }: AdminOffersSearch) {
  const needle = q.trim().toLowerCase();
  return offers.filter(
    (offer) =>
      (state === null || offer.closed === (state === "closed")) &&
      (needle === "" ||
        [offer.title, offer.url, offer.organizationName].some((text) =>
          text.toLowerCase().includes(needle),
        )),
  );
}

/**
 * Admin › Offers: what solutions come with, such as cloud credits, by the organization that gives
 * each, which only its solutions come with. An operator reads them here, corrects, closes and
 * deletes them, and marks the ones GenAI Fund arranged; a new one is written on the record of its
 * organization. A closed offer is chosen by no more solutions, and stays on those that come with it.
 * Its record names them.
 */
function AdminOffersPage({ offers, search }: { offers: AdminOffer[]; search: AdminOffersSearch }) {
  const t = useTranslations("Admin.offers");
  // The words of a list of offers, which an organization's own list shares.
  const list = useTranslations("Solution.offers.manage");
  const locale = useLocale();
  const shown = matching(offers, search);
  const empty =
    shown.length > 0 ? null : offers.length === 0 ? (
      <DataTableEmpty
        icon={<GiftIcon aria-hidden="true" />}
        title={list("empty.title")}
        description={t("empty")}
      />
    ) : (
      <DataTableEmpty icon={<SearchXIcon aria-hidden="true" />} title={t("noMatch")} />
    );
  const record = (offer: AdminOffer) => `${siteRoutes.adminOffers}/${offer.id}`;

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <AdminPageHeader destination="offers" title={t("title")} />
      <OffersToolbar />

      {/* Where the table is made to fit, the address joins the offer; on a phone it keeps its column. */}
      <DataTableRows
        columns={[
          { id: "title", header: list("columns.offer"), layout: { fill: true } },
          { id: "writer", header: t("columns.writer"), layout: { width: "md" } },
          { id: "state", header: t("columns.state") },
          { id: "url", header: list("columns.url"), layout: { from: "lg", width: "lg" } },
          { id: "solutions", header: list("columns.solutions"), layout: { numeric: true } },
          {
            id: "actions",
            header: <span className="sr-only">{list("columns.actions")}</span>,
            layout: { width: "action" },
          },
        ]}
        rows={shown.map((offer) => ({
          id: offer.id,
          cells: {
            title: (
              <div className="flex min-w-0 flex-col">
                <Link
                  href={record(offer)}
                  className="truncate rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <OfferTitle offer={offer} />
                </Link>
                <span className="hidden min-w-0 md:max-lg:block">
                  <OfferAddress url={offer.url} />
                </span>
              </div>
            ),
            writer: <span className="block max-w-36 truncate">{offer.organizationName}</span>,
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
        empty={empty}
      />
    </div>
  );
}

export { AdminOffersPage };
