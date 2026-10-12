import { ArrowUpRightIcon, GiftIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { DataTableEmpty } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import type { AdminOffer } from "@/lib/api/generated";

import { CreateOffer, OfferRowMenu } from "./offer-actions";

/** Where an offer is claimed, as a link that opens beside the admin area. */
function OfferAddress({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-w-0 items-center gap-1 rounded-sm text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="truncate">{url.replace(/^https:\/\//, "")}</span>
      <ArrowUpRightIcon className="size-3.5 shrink-0" aria-hidden="true" />
    </a>
  );
}

/**
 * Admin › Offers: what solutions come with, such as cloud credits. GenAI Fund's own list, which
 * every solution chooses from, comes first; then the offers each organization wrote for its own
 * solutions, which an operator reads here, corrects and deletes. Changing an offer changes it on
 * every solution that comes with it, and it is deleted once none does.
 */
function AdminOffersPage({ offers }: { offers: AdminOffer[] }) {
  const t = useTranslations("Admin.offers");
  // The words of a list of offers, which an organization's own list shares.
  const list = useTranslations("Solution.offers.manage");
  const locale = useLocale();
  const empty =
    offers.length > 0 ? null : (
      <DataTableEmpty
        icon={<GiftIcon aria-hidden="true" />}
        title={list("empty.title")}
        description={list("empty.description")}
      />
    );

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <AdminPageHeader
        destination="offers"
        title={t("title")}
        lead={t("lead")}
        actions={<CreateOffer />}
      />

      {/* From 768px: a table. */}
      <DataTableRows
        className="hidden md:flex"
        columns={[
          { id: "title", header: list("columns.offer"), layout: { fill: true } },
          { id: "writer", header: t("columns.writer"), layout: { from: "md" } },
          { id: "url", header: list("columns.url"), layout: { from: "lg", width: "lg" } },
          { id: "solutions", header: list("columns.solutions"), layout: { numeric: true } },
          { id: "actions", header: <span className="sr-only">{list("columns.actions")}</span> },
        ]}
        rows={offers.map((offer) => ({
          id: offer.id,
          cells: {
            title: (
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{offer.title}</span>
                <span className="min-w-0 lg:hidden">
                  <OfferAddress url={offer.url} />
                </span>
              </div>
            ),
            writer: offer.organizationName ?? t("genAiFund"),
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
        {offers.map((offer) => (
          <li
            key={offer.id}
            className="flex items-start justify-between gap-3 border-b p-3 last:border-b-0"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium wrap-break-word">{offer.title}</span>
              <span className="min-w-0 text-sm">
                <OfferAddress url={offer.url} />
              </span>
              <span className="text-xs text-muted-foreground">
                {offer.organizationName ?? t("genAiFund")} ·{" "}
                {list("solutions", { count: offer.solutions })}
              </span>
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
