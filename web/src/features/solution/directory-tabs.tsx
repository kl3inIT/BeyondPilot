import { useTranslations } from "next-intl";

import { PageTabs } from "@/components/composites/page-tabs";
import { siteRoutes } from "@/lib/site";

const tabs = [
  { key: "solutions", href: siteRoutes.solutions },
  { key: "perks", href: siteRoutes.perks },
] as const;

/** The two pages of AI solutions: the solutions GenAI Fund approved, and the perks organizations give. */
function DirectoryTabs({ current }: { current: (typeof tabs)[number]["key"] }) {
  const t = useTranslations("Solution.directory.tabs");

  return (
    <PageTabs
      label={t("label")}
      current={current}
      tabs={tabs.map((tab) => ({ ...tab, label: t(tab.key) }))}
    />
  );
}

export { DirectoryTabs };
