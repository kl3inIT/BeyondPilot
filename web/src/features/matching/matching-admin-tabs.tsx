import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { siteRoutes } from "@/lib/site";

const tabs = [
  { key: "limits", href: siteRoutes.adminAiMatching },
  { key: "feedback", href: siteRoutes.adminAiMatchingFeedback },
] as const;

/**
 * The two pages of Admin › AI › Matching: the limits operators set, and what people said about the
 * groups the AI gave. The row links between them and is drawn on both; each has its own address, so
 * leaving the limits with a change unsaved asks first, as any link does.
 */
function MatchingAdminTabs({ current }: { current: (typeof tabs)[number]["key"] }) {
  const t = useTranslations("Admin.matching");

  return (
    <nav aria-label={t("title")} className="flex items-end gap-5 border-b">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === current ? "page" : undefined}
          className="-mb-px flex items-center border-b-2 border-transparent px-0.5 py-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset aria-[current=page]:border-foreground aria-[current=page]:text-foreground pointer-coarse:min-h-11"
        >
          {t(`tabs.${tab.key}`)}
        </Link>
      ))}
    </nav>
  );
}

export { MatchingAdminTabs };
