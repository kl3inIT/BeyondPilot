import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import type { OwnPerk } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { PerksTable } from "./perks-table";

/**
 * The Perks tab of an organization's record in Admin: what the organization gives. An operator writes
 * a perk here for an organization nobody signed in for, such as credits GenAI Fund arranged.
 */
function AdminOrganizationPerks({
  organizationId,
  perks,
}: {
  organizationId: string;
  perks: OwnPerk[];
}) {
  const t = useTranslations("Perk.manage");

  return (
    <section aria-labelledby="organization-perks" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="organization-perks" className="text-lg font-semibold">
          {t("title")}
        </h2>
        <Button
          size="lg"
          prominence="secondary"
          href={`${siteRoutes.adminPerks}/new?${new URLSearchParams({ organizationId })}`}
        >
          <PlusIcon aria-hidden="true" />
          {t("create.action")}
        </Button>
      </div>
      <PerksTable perks={perks} side="admin" oneOrganization empty={t("organizationEmpty")} />
    </section>
  );
}

export { AdminOrganizationPerks };
