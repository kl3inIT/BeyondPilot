import { GiftIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { DataTableEmpty } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { Status } from "@/components/composites/status";
import { OrganizationFrame } from "@/features/organization/organization-frame";
import { OrganizationSection } from "@/features/organization/organization-section";
import { useFormatter } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import type { MyOrganization, Organization, OwnPerk, TeamClaim } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { PerksTable } from "./perks-table";

const tones = {
  taken: "success",
  granted: "success",
  waiting: "warning",
  declined: "destructive",
} as const;

const link =
  "rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";

type TeamPerksPageProps = {
  mine: MyOrganization & { organization: Organization };
  counts: { members: number; solutions: number | null; useCases: number | null };
  /** What anyone in the organization got. */
  claims: TeamClaim[];
  /** What the organization gives. */
  perks: OwnPerk[];
};

/**
 * My organization › Perks: the perks anyone in the team got, with the code or the page each holds on
 * its own page, and the perks the organization gives, with who got them.
 */
function TeamPerksPage({ mine, counts, claims, perks }: TeamPerksPageProps) {
  const t = useTranslations("Perk.team");
  const manage = useTranslations("Perk.manage");
  const claim = useTranslations("Perk.claim.state");
  const format = useFormatter();

  return (
    <OrganizationFrame mine={mine} current="perks" counts={counts}>
      <OrganizationSection
        id="perks-got"
        title={t("got.title")}
        action={
          <Button prominence="secondary" href={`${siteRoutes.solutions}?perks=active`}>
            {t("got.browse")}
          </Button>
        }
      >
        <DataTableRows
          columns={[
            { id: "perk", header: t("got.columns.perk"), layout: { fill: true } },
            { id: "partner", header: t("got.columns.partner"), layout: { width: "md" } },
            { id: "state", header: t("got.columns.state") },
            { id: "by", header: t("got.columns.by"), layout: { from: "lg" } },
          ]}
          rows={claims.map((held) => ({
            id: held.claim.id,
            cells: {
              perk: (
                <div className="flex min-w-0 flex-col">
                  <Link
                    href={`${siteRoutes.perks}/${held.slug}`}
                    className={`truncate font-medium ${link}`}
                  >
                    {held.title}
                  </Link>
                  {held.value && (
                    <span className="truncate text-xs text-muted-foreground">{held.value}</span>
                  )}
                </div>
              ),
              partner: <span className="block max-w-36 truncate">{held.partnerName}</span>,
              state: (
                <Status tone={tones[held.claim.state]} appearance="pill">
                  {claim(held.claim.state)}
                </Status>
              ),
              by: (
                <span className="text-muted-foreground">
                  {t("got.byLine", {
                    name: held.claim.takenBy,
                    date: format.dateTime(new Date(held.claim.takenAt), "date"),
                  })}
                </span>
              ),
            },
          }))}
          empty={
            claims.length > 0 ? null : (
              <DataTableEmpty
                icon={<GiftIcon aria-hidden="true" />}
                title={t("got.empty.title")}
                description={t("got.empty.description")}
              />
            )
          }
        />
      </OrganizationSection>

      <OrganizationSection
        id="perks-given"
        title={t("given.title")}
        action={
          <Button href={`${siteRoutes.workspacePerks}/new`}>{manage("create.action")}</Button>
        }
      >
        <PerksTable perks={perks} side="own" empty={t("given.empty")} />
      </OrganizationSection>
    </OrganizationFrame>
  );
}

export { TeamPerksPage };
