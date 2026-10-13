import { useTranslations } from "next-intl";

import { PageTabs } from "@/components/composites/page-tabs";
import {
  adminUseCaseCandidatesRoute,
  adminUseCaseProposalsRoute,
  siteRoutes,
  workspaceUseCaseCandidatesRoute,
} from "@/lib/site";

type UseCaseTabsProps = {
  /** Whose pages the tabs link: the organization's own, or the operators'. */
  area: "workspace" | "admin";
  id: string;
  current: "brief" | "candidates" | "proposals";
  /** How many proposals the use case received; GenAI Fund also has a tab for them. */
  proposals?: number;
};

/**
 * The pages of a published use case: what it asks for, the solutions matched to it and, for GenAI Fund,
 * the proposals it received. The row links between them; it is drawn on every page.
 */
function UseCaseTabs({ area, id, current, proposals }: UseCaseTabsProps) {
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
    ...(area === "admin"
      ? [{ key: "proposals" as const, href: adminUseCaseProposalsRoute(id) }]
      : []),
  ];

  return (
    <PageTabs
      label={t("label")}
      current={current}
      tabs={tabs.map((tab) => ({
        ...tab,
        label: t(tab.key),
        count: tab.key === "proposals" ? proposals : undefined,
      }))}
    />
  );
}

export { UseCaseTabs };
