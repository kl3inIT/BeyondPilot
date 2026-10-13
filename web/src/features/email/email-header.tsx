import { TriangleAlertIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import { PageTabs } from "@/components/composites/page-tabs";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
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
    <AdminPageHeader destination="email" title={t("title")} actions={action}>
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
      <PageTabs
        label={t("tabs.label")}
        current={current}
        tabs={tabs.map((tab) => ({ ...tab, label: t(`tabs.${tab.key}`) }))}
      />
    </AdminPageHeader>
  );
}

export { EmailHeader, type EmailTab };
