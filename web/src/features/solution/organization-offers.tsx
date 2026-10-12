import { ArrowUpRightIcon, GiftIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { DataTableEmpty } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { OrganizationSection } from "@/features/organization/organization-section";
import type { OwnOffer } from "@/lib/api/generated";

import { CreateOffer, OfferRowMenu } from "./offer-actions";
import { OfferState } from "./offer-state";

type OrganizationOffersProps = {
  offers: OwnOffer[];
  /** Whether the caller may change the organization's solutions, and so its offers. */
  editable: boolean;
};

/**
 * My organization › Solutions › Offers: what the organization wrote for its solutions to come with,
 * such as a pilot package. An offer is written here or while a solution is edited, chosen on the
 * solutions it goes with, and deleted once none comes with it.
 */
function OrganizationOffers({ offers, editable }: OrganizationOffersProps) {
  const t = useTranslations("Solution.offers.manage");
  const address = (url: string) => (
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

  return (
    <OrganizationSection
      id="offers-list"
      title={t("title")}
      summary={offers.length > 0 ? String(offers.length) : undefined}
      action={editable && <CreateOffer own />}
    >
      {offers.length === 0 ? (
        <div className="rounded-lg border bg-background">
          <DataTableEmpty
            icon={<GiftIcon aria-hidden="true" />}
            title={t("empty.title")}
            description={editable ? t("empty.own") : undefined}
          />
        </div>
      ) : (
        <>
          {/* From 768px: a table. */}
          <DataTableRows
            className="hidden md:flex"
            surface
            columns={[
              { id: "title", header: t("columns.offer"), layout: { fill: true } },
              { id: "state", header: t("columns.state") },
              { id: "url", header: t("columns.url"), layout: { width: "lg" } },
              { id: "solutions", header: t("columns.solutions"), layout: { numeric: true } },
              ...(editable
                ? [
                    {
                      id: "actions",
                      header: <span className="sr-only">{t("columns.actions")}</span>,
                      layout: { width: "action" as const },
                    },
                  ]
                : []),
            ]}
            rows={offers.map((offer) => ({
              id: offer.id,
              cells: {
                title: <span className="truncate font-medium">{offer.title}</span>,
                state: <OfferState closed={offer.closed} />,
                url: address(offer.url),
                solutions: offer.solutions,
                actions: (
                  <div className="flex justify-end">
                    <OfferRowMenu offer={offer} own />
                  </div>
                ),
              },
            }))}
          />

          {/* Below 768px: one stacked row per offer, never a table scrolled sideways. */}
          <ul className="overflow-hidden rounded-lg border bg-background md:hidden">
            {offers.map((offer) => (
              <li
                key={offer.id}
                className="flex items-start justify-between gap-3 border-b p-3 last:border-b-0"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm font-medium wrap-break-word">{offer.title}</span>
                  <span className="min-w-0 text-sm">{address(offer.url)}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("solutions", { count: offer.solutions })}
                  </span>
                  <OfferState closed={offer.closed} />
                </div>
                {editable && <OfferRowMenu offer={offer} own />}
              </li>
            ))}
          </ul>
        </>
      )}
    </OrganizationSection>
  );
}

export { OrganizationOffers };
