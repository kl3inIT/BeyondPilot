import { getLocale, getTranslations } from "next-intl/server";

import { PageTabs } from "@/components/composites/page-tabs";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { siteRoutes } from "@/lib/site";

const tabs = ["chat", "embedding", "ocr"] as const;

type ProvidersTab = (typeof tabs)[number];

/** The tab an address asks for: Chat unless it names another one. */
function providersTab(asked: string | string[] | undefined): ProvidersTab {
  return tabs.find((each) => each === asked) ?? "chat";
}

/**
 * Admin › AI › Providers: the AI services BeyondPilot calls, with a tab per purpose. Chat comes
 * first; each tab is an address of its own, so it can be linked and reloaded.
 */
async function ProvidersShell({ tab, children }: { tab: ProvidersTab; children: React.ReactNode }) {
  const [t, locale] = await Promise.all([getTranslations("Admin.ai.providers"), getLocale()]);

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <AdminPageHeader destination="aiProviders" title={t("title")}>
        <PageTabs
          label={t("tabs")}
          current={tab}
          tabs={tabs.map((each) => ({
            key: each,
            label: t(each),
            href:
              each === "chat"
                ? siteRoutes.adminAiProviders
                : { pathname: siteRoutes.adminAiProviders, query: { tab: each } },
          }))}
        />
      </AdminPageHeader>

      {children}
    </div>
  );
}

export { ProvidersShell, providersTab };
