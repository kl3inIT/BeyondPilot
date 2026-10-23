import { GiftIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { DataTableEmpty } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { Status } from "@/components/composites/status";
import { useFormatter } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import type { OwnPerk } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { PerkState } from "./perk-actions";

const link =
  "rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";

type PerksTableProps = {
  perks: OwnPerk[];
  /** `admin` opens each perk in Admin and names the organization that gives it. */
  side: "own" | "admin";
  /** Hides the organization's column, on a list of one organization's perks. */
  oneOrganization?: boolean;
  /** What the empty list says. */
  empty: string;
};

/**
 * Perks as their partner and the operators manage them: each with its state, how it is got, how many
 * teams got it out of its places, and the requests that wait for an answer.
 */
function PerksTable({ perks, side, oneOrganization = side === "own", empty }: PerksTableProps) {
  const t = useTranslations("Perk.manage");
  const format = useFormatter();
  const record = (perk: OwnPerk) =>
    `${side === "admin" ? siteRoutes.adminPerks : siteRoutes.workspacePerks}/${perk.id}`;

  return (
    <DataTableRows
      columns={[
        { id: "title", header: t("columns.perk"), layout: { fill: true } },
        ...(oneOrganization
          ? []
          : [
              {
                id: "organization",
                header: t("columns.organization"),
                layout: { width: "md" as const },
              },
            ]),
        { id: "state", header: t("columns.state") },
        { id: "way", header: t("columns.way"), layout: { from: "lg" as const } },
        { id: "taken", header: t("columns.taken"), layout: { numeric: true } },
        { id: "ends", header: t("columns.ends"), layout: { from: "lg" as const } },
      ]}
      rows={perks.map((perk) => ({
        id: perk.id,
        cells: {
          title: (
            <div className="flex min-w-0 flex-col">
              <Link href={record(perk)} className={`truncate font-medium ${link}`}>
                {perk.title}
              </Link>
              {perk.value && (
                <span className="truncate text-xs text-muted-foreground">{perk.value}</span>
              )}
            </div>
          ),
          organization: <span className="block max-w-36 truncate">{perk.organizationName}</span>,
          state: (
            <div className="flex flex-wrap items-center gap-1.5">
              <PerkState state={perk.state} />
              {perk.waiting > 0 && (
                <Status tone="warning" appearance="pill">
                  {t("waiting", { count: perk.waiting })}
                </Status>
              )}
            </div>
          ),
          way: t(`way.${perk.way}`),
          taken: perk.places ? `${perk.taken} / ${perk.places}` : perk.taken,
          ends: perk.endsAt ? format.dateTime(new Date(perk.endsAt), "date") : "",
        },
      }))}
      empty={
        perks.length > 0 ? null : (
          <DataTableEmpty icon={<GiftIcon aria-hidden="true" />} title={empty} />
        )
      }
    />
  );
}

export { PerksTable };
