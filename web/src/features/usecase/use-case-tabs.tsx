import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import {
  adminUseCaseCandidatesRoute,
  siteRoutes,
  workspaceUseCaseCandidatesRoute,
} from "@/lib/site";

type UseCaseTabsProps = {
  /** Whose pages the tabs link: the organization's own, or the operators'. */
  area: "workspace" | "admin";
  id: string;
  current: "brief" | "candidates";
};

/**
 * The two pages of a published use case: what it asks for, and the solutions matched to it. The row
 * links between them; it is drawn on both.
 */
function UseCaseTabs({ area, id, current }: UseCaseTabsProps) {
  const t = useTranslations("Matching.pageTabs");
  const tabs = [
    {
      key: "brief" as const,
      href: `${area === "admin" ? siteRoutes.adminUseCases : siteRoutes.workspaceUseCases}/${id}`,
    },
    {
      key: "candidates" as const,
      href:
        area === "admin" ? adminUseCaseCandidatesRoute(id) : workspaceUseCaseCandidatesRoute(id),
    },
  ];

  return (
    <nav aria-label={t("label")} className="flex items-end gap-5 border-b">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === current ? "page" : undefined}
          className="-mb-px flex items-center border-b-2 border-transparent px-0.5 py-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset aria-[current=page]:border-foreground aria-[current=page]:text-foreground pointer-coarse:min-h-11"
        >
          {t(tab.key)}
        </Link>
      ))}
    </nav>
  );
}

export { UseCaseTabs };
