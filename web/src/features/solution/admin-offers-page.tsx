import { GiftIcon, SearchXIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { DataTableEmpty } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { Link } from "@/i18n/navigation";
import type { AdminOffer } from "@/lib/api/generated";
import { cn } from "@/lib/utils";
import { siteRoutes } from "@/lib/site";

import { CreateOffer, OfferRowMenu } from "./offer-actions";
import { OfferAddress } from "./offer-address";
import { OfferState } from "./offer-state";
import type { AdminOffersSearch } from "./offers-search";
import { OffersToolbar } from "./offers-toolbar";

/** The offers the search and the state filter leave, in the order they came. */
function matching(offers: AdminOffer[], { q, state }: AdminOffersSearch) {
  const needle = q.trim().toLowerCase();
  return offers.filter(
    (offer) =>
      (state === null || offer.closed === (state === "closed")) &&
      (needle === "" ||
        [offer.title, offer.url, offer.organizationName ?? ""].some((text) =>
          text.toLowerCase().includes(needle),
        )),
  );
}

/**
 * Admin › Offers: what solutions come with, such as cloud credits. GenAI Fund's own list, which
 * every solution chooses from, comes first; then the offers each organization wrote for its own
 * solutions, which an operator reads here, corrects, closes and deletes. A closed offer is chosen by
 * no more solutions, and stays on those that come with it. Its record names them.
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
        description={list("empty.description")}
      />
    ) : (
      <DataTableEmpty icon={<SearchXIcon aria-hidden="true" />} title={t("noMatch")} />
    );
  const record = (offer: AdminOffer) => `${siteRoutes.adminOffers}/${offer.id}`;
  const name = (offer: AdminOffer, className: string) => (
    <Link
      href={record(offer)}
      className={cn(
        "rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      {offer.title}
    </Link>
  );

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <AdminPageHeader destination="offers" title={t("title")} actions={<CreateOffer />} />
      <OffersToolbar />

      {/* From 768px: a table. */}
      <DataTableRows
        className="hidden md:flex"
        columns={[
          { id: "title", header: list("columns.offer"), layout: { fill: true } },
          { id: "writer", header: t("columns.writer"), layout: { from: "md" } },
          { id: "state", header: t("columns.state") },
          { id: "url", header: list("columns.url"), layout: { from: "lg", width: "lg" } },
          { id: "solutions", header: list("columns.solutions"), layout: { numeric: true } },
          { id: "actions", header: <span className="sr-only">{list("columns.actions")}</span> },
        ]}
        rows={shown.map((offer) => ({
          id: offer.id,
          cells: {
            title: (
              <div className="flex min-w-0 flex-col">
                {name(offer, "truncate font-medium")}
                <span className="min-w-0 lg:hidden">
                  <OfferAddress url={offer.url} />
                </span>
              </div>
            ),
            writer: offer.organizationName ?? t("genAiFund"),
            state: <OfferState closed={offer.closed} />,
            url: <OfferAddress url={offer.url} />,
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

      {/* Below 768px: one stacked row per offer, never a table scrolled sideways. */}
      <ul className="overflow-hidden rounded-lg border md:hidden">
        {shown.map((offer) => (
          <li
            key={offer.id}
            className="flex items-start justify-between gap-3 border-b p-3 last:border-b-0"
          >
            <div className="flex min-w-0 flex-col gap-1">
              {name(offer, "text-sm font-medium wrap-break-word")}
              <span className="min-w-0 text-sm">
                <OfferAddress url={offer.url} />
              </span>
              <span className="text-xs text-muted-foreground">
                {offer.organizationName ?? t("genAiFund")} ·{" "}
                {list("solutions", { count: offer.solutions })}
              </span>
              <OfferState closed={offer.closed} />
            </div>
            <OfferRowMenu offer={offer} />
          </li>
        ))}
        {empty && <li>{empty}</li>}
      </ul>
    </div>
  );
}

export { AdminOffersPage };
