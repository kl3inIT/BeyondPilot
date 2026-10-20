import { GiftIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { DataTableEmpty } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { OrganizationSection } from "@/features/organization/organization-section";
import type { OwnOffer } from "@/lib/api/generated";

import { CreateOffer, OfferRowMenu } from "./offer-actions";
import { OfferAddress } from "./offer-address";
import { OfferState } from "./offer-state";
import { OfferTitle } from "./solution-offers";

type OrganizationOffersProps = {
  offers: OwnOffer[];
  /** Whether the caller may change the organization's solutions, and so its offers. */
  editable: boolean;
};

/**
 * My organization › Solutions › Offers: what the organization gives with its solutions, such as a
 * pilot package. An offer is written here or while a solution is edited, chosen on the solutions it
 * goes with, and deleted once none comes with it. One GenAI Fund arranged carries its mark and is
 * GenAI Fund's to change, so it has no actions here.
 */
function OrganizationOffers({ offers, editable }: OrganizationOffersProps) {
  const t = useTranslations("Solution.offers.manage");
  return (
    <OrganizationSection
      id="offers-list"
      title={t("title")}
      summary={offers.length > 0 ? String(offers.length) : undefined}
      action={editable && <CreateOffer />}
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
        <DataTableRows
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
              title: (
                <span className="block truncate font-medium">
                  <OfferTitle offer={offer} />
                </span>
              ),
              state: <OfferState closed={offer.closed} />,
              url: (
                <div className="w-56">
                  <OfferAddress url={offer.url} />
                </div>
              ),
              solutions: offer.solutions,
              actions: offer.fromGenAiFund ? null : (
                <div className="flex justify-end">
                  <OfferRowMenu offer={offer} own />
                </div>
              ),
            },
          }))}
        />
      )}
    </OrganizationSection>
  );
}

export { OrganizationOffers };
