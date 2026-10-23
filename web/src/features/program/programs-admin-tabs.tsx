import { useTranslations } from "next-intl";

import { PageTabs } from "@/components/composites/page-tabs";
import { siteRoutes } from "@/lib/site";

const tabs = [
  { key: "programs", href: siteRoutes.adminPrograms },
  { key: "luma", href: siteRoutes.adminProgramsLuma },
] as const;

/**
 * The pages of Admin › Programs: the programs, and the Luma calendar whose events become programs
 * by themselves (BEY-245). The row links between them and is drawn on each.
 */
function ProgramsAdminTabs({ current }: { current: (typeof tabs)[number]["key"] }) {
  const t = useTranslations("Admin.programs");

  return (
    <PageTabs
      label={t("title")}
      current={current}
      tabs={tabs.map((tab) => ({ ...tab, label: t(`sections.${tab.key}`) }))}
    />
  );
}

export { ProgramsAdminTabs };
