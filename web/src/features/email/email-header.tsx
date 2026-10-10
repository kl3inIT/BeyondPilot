import { TriangleAlertIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import { AdminPageTitle } from "@/components/layout/admin-icons";
import { Link } from "@/i18n/navigation";
import { siteRoutes } from "@/lib/site";

type EmailTab = "templates" | "activity" | "suppressions" | "settings";

/**
 * The head of Admin › Email: its title, a warning while no email can leave, and the four screens.
 * `action` is the screen's own button, beside the title.
 */
async function EmailHeader({
  current,
  ready,
  action,
}: {
  current: EmailTab;
  /** Whether email can leave now; null when the screen did not read the settings. */
  ready: boolean | null;
  action?: React.ReactNode;
}) {
  const t = await getTranslations("Admin.email");
  const tabs = [
    { key: "templates", href: siteRoutes.adminEmailTemplates },
    { key: "activity", href: siteRoutes.adminEmailActivity },
    { key: "suppressions", href: siteRoutes.adminEmailSuppressions },
    { key: "settings", href: siteRoutes.adminEmailSettings },
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <AdminPageTitle destination="email">{t("title")}</AdminPageTitle>
        {action}
      </div>
      {ready === false && current !== "settings" && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-lg border bg-accent px-4 py-3 md:flex-row md:items-center"
        >
          <TriangleAlertIcon aria-hidden="true" className="size-4 shrink-0 text-warning" />
          <div className="flex flex-1 flex-col gap-0.5">
            <p className="text-sm font-medium">{t("notReady.title")}</p>
            <p className="text-sm text-muted-foreground">{t("notReady.description")}</p>
          </div>
          <Button prominence="secondary" size="sm" href={siteRoutes.adminEmailSettings}>
            {t("notReady.action")}
          </Button>
        </div>
      )}
      <nav aria-label={t("tabs.label")} className="border-b">
        <ul className="flex gap-4 overflow-x-auto md:gap-6">
          {tabs.map((tab) => (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={tab.key === current ? "page" : undefined}
                className={
                  tab.key === current
                    ? "inline-flex min-h-11 items-center border-b-2 border-foreground text-sm font-medium whitespace-nowrap outline-none focus-visible:underline"
                    : "inline-flex min-h-11 items-center border-b-2 border-transparent text-sm whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:underline"
                }
              >
                {t(`tabs.${tab.key}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export { EmailHeader, type EmailTab };
