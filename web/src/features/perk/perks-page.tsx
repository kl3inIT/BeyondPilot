import { GiftIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { DataTableEmpty } from "@/components/composites/data-table";
import { DirectoryTabs } from "@/features/solution/directory-tabs";
import type { PerkCard as PerkCardData } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { PerkCard } from "./perk-card";

type PerksPageProps = {
  perks: PerkCardData[];
  /** Whether the perks that ended are listed too, as the URL asks. */
  ended: boolean;
};

/**
 * AI solutions › Perks: what organizations give to members of BeyondPilot, the latest published
 * first. Anyone reads every perk and who it is for; each card says whether the reader's team may get
 * it. The perks that ended leave the list unless they are asked for.
 */
function PerksPage({ perks, ended }: PerksPageProps) {
  const t = useTranslations("Perk.catalogue");
  const directory = useTranslations("Solution.directory");

  return (
    <div className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-5 px-5 pt-8 pb-18 md:gap-7 md:px-8 md:pt-12 md:pb-22 xl:px-16 xl:pt-14 xl:pb-24 desktop:px-20">
      <header className="flex flex-col gap-2.5">
        <h1 className="text-3xl font-semibold tracking-title md:text-4xl xl:text-5xl xl:leading-none">
          {directory("title")}
        </h1>
        <p className="max-w-180 text-base text-muted-foreground md:text-lg">{t("lead")}</p>
      </header>
      <DirectoryTabs current="perks" />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("count", { count: perks.length })}</p>
        <TextButton size="sm" href={ended ? siteRoutes.perks : `${siteRoutes.perks}?ended=true`}>
          {t(ended ? "hideEnded" : "showEnded")}
        </TextButton>
      </div>

      {perks.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {perks.map((perk) => (
            <li key={perk.id} className="flex min-w-0">
              <PerkCard perk={perk} />
            </li>
          ))}
        </ul>
      ) : (
        <DataTableEmpty
          icon={<GiftIcon aria-hidden="true" />}
          title={t("empty.title")}
          description={t("empty.description")}
        />
      )}
    </div>
  );
}

export { PerksPage };
