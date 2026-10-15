import { useTranslations } from "next-intl";

import { PageTabs } from "@/components/composites/page-tabs";
import { siteRoutes } from "@/lib/site";

const tabs = [
  { key: "limits", href: siteRoutes.adminAiMatching },
  { key: "feedback", href: siteRoutes.adminAiMatchingFeedback },
  { key: "runs", href: siteRoutes.adminAiMatchingRuns },
] as const;

/**
 * The pages of Admin › AI › Matching: the limits operators set, what people said about the groups
 * the AI gave, and the runs with what they cost. The row links between them and is drawn on each;
 * each has its own address, so leaving the limits with a change unsaved asks first, as any link does.
 */
function MatchingAdminTabs({ current }: { current: (typeof tabs)[number]["key"] }) {
  const t = useTranslations("Admin.matching");

  return (
    <PageTabs
      label={t("title")}
      current={current}
      tabs={tabs.map((tab) => ({ ...tab, label: t(`tabs.${tab.key}`) }))}
    />
  );
}

export { MatchingAdminTabs };
