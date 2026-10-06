import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { adminOrganizationSolutionsRoute, siteRoutes } from "@/lib/site";

type AdminOrganizationTabsProps = {
  id: string;
  current: "profile" | "solutions";
  /** How many solutions it has sent for review; `null` for an organization that provides none. */
  solutions: number | null;
};

/**
 * The tabs of an organization's record in the admin area. Only a provider has solutions, so any
 * other organization has its profile alone and no tabs.
 */
function AdminOrganizationTabs({ id, current, solutions }: AdminOrganizationTabsProps) {
  const t = useTranslations("Admin.organizations.detail.tabs");
  if (solutions === null) {
    return null;
  }

  const tabs = [
    { key: "profile", href: `${siteRoutes.adminOrganizations}/${id}`, label: t("profile") },
    {
      key: "solutions",
      href: adminOrganizationSolutionsRoute(id),
      label: t("solutions"),
      count: solutions,
    },
  ];

  return (
    <nav aria-label={t("label")} className="flex items-end gap-5 border-b">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === current ? "page" : undefined}
          className="group -mb-px flex items-center gap-1.5 border-b-2 border-transparent px-0.5 py-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset aria-[current=page]:border-foreground aria-[current=page]:text-foreground"
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="text-xs group-aria-[current=page]:text-primary">{tab.count}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

export { AdminOrganizationTabs };
