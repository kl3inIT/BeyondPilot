import { useTranslations } from "next-intl";

import { PageTabs } from "@/components/composites/page-tabs";
import { siteRoutes } from "@/lib/site";

const tabs = [
  { key: "solutions", href: siteRoutes.adminSolutions },
  { key: "perks", href: siteRoutes.adminPerks },
] as const;

/**
 * The pages of Admin › AI solutions: the solutions operators review, and every organization's
 * perks, which the catalogue and the solutions' cards show. The row links between them and is drawn on each.
 */
function SolutionsAdminTabs({ current }: { current: (typeof tabs)[number]["key"] }) {
  const t = useTranslations("Admin.solutions");

  return (
    <PageTabs
      label={t("title")}
      current={current}
      tabs={tabs.map((tab) => ({ ...tab, label: t(`tabs.${tab.key}`) }))}
    />
  );
}

export { SolutionsAdminTabs };
