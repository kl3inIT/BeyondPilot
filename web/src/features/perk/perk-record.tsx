import { ArrowLeftIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { OwnPerk, Perk, PerkClaimRow, PerkOptions } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { CreateAdminPerk, PerkActions, PerkState } from "./perk-actions";
import { PerkClaims } from "./perk-claims";
import { PerkCodes } from "./perk-codes";
import { PerkForm } from "./perk-form";
import { SolutionsAdminTabs } from "@/features/solution/solutions-admin-tabs";
import { PerksTable } from "./perks-table";

type PerkRecordProps = {
  /** The perk; none for a new one. */
  perk?: Perk;
  options: PerkOptions;
  claims: PerkClaimRow[];
  side: "own" | "admin";
  /** For an operator's new perk: the organization that gives it. */
  organizationId?: string;
};

/**
 * What a perk's record holds below its header: its form, the codes an operator loads for a perk given
 * as a list, and who got it.
 */
function PerkRecordBody({ perk, options, claims, side, organizationId }: PerkRecordProps) {
  const t = useTranslations("Perk.manage");

  return (
    <div className="flex w-full max-w-4xl flex-col gap-10">
      {perk && !perk.editable && (
        <Alert>
          <AlertDescription>{t("arranged")}</AlertDescription>
        </Alert>
      )}
      <div className="rounded-3xl border bg-background p-5 md:p-8">
        <PerkForm perk={perk} options={options} side={side} organizationId={organizationId} />
      </div>
      {perk && side === "admin" && perk.way === "codes" && <PerkCodes perk={perk} />}
      {perk && perk.state !== "draft" && <PerkClaims perk={perk} claims={claims} side={side} />}
    </div>
  );
}

/** My organization › Perks › one perk, or a new one: the perk's form and who got it. */
function OwnPerkPage(props: Omit<PerkRecordProps, "side" | "organizationId">) {
  const t = useTranslations("Perk.manage");
  const { perk } = props;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 py-8 md:px-8">
      <TextButton href={siteRoutes.workspacePerks} className="self-start">
        <ArrowLeftIcon aria-hidden="true" />
        {t("back")}
      </TextButton>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{perk?.title ?? t("new")}</h1>
        {perk && <PerkState state={perk.state} />}
        {perk && (
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <PerkActions perk={perk} side="own" />
          </div>
        )}
      </div>
      <PerkRecordBody {...props} side="own" />
    </div>
  );
}

/** Admin › AI solutions › Perks › one perk, or a new one for an organization. */
function AdminPerkPage(props: Omit<PerkRecordProps, "side">) {
  const t = useTranslations("Perk.manage");
  const locale = useLocale();
  const { perk } = props;

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <AdminPageHeader
        back={{ href: siteRoutes.adminPerks, label: t("adminBack") }}
        title={perk?.title ?? t("new")}
        badges={perk && <PerkState state={perk.state} />}
        actions={perk && <PerkActions perk={perk} side="admin" />}
      />
      {perk && (
        <p className="text-sm text-muted-foreground">{t("by", { name: perk.organizationName })}</p>
      )}
      <PerkRecordBody {...props} side="admin" />
    </div>
  );
}

/** Admin › AI solutions › Perks: every perk, by the organization that gives it. */
function AdminPerksPage({ perks }: { perks: OwnPerk[] }) {
  const t = useTranslations("Perk.manage");
  const solutions = useTranslations("Admin.solutions");
  const locale = useLocale();

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <AdminPageHeader
        destination="solutions"
        title={solutions("title")}
        actions={<CreateAdminPerk />}
      >
        <SolutionsAdminTabs current="perks" />
      </AdminPageHeader>
      <PerksTable perks={perks} side="admin" empty={t("empty")} />
    </div>
  );
}

export { AdminPerkPage, AdminPerksPage, OwnPerkPage };
