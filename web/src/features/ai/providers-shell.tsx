import { getLocale, getTranslations } from "next-intl/server";

import { AdminPageTitle } from "@/components/layout/admin-icons";
import { Link } from "@/i18n/navigation";
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
      <AdminPageTitle destination="aiProviders">{t("title")}</AdminPageTitle>

      <nav aria-label={t("tabs")} className="flex items-end gap-5 border-b">
        {tabs.map((each) => (
          <Link
            key={each}
            href={
              each === "chat"
                ? siteRoutes.adminAiProviders
                : { pathname: siteRoutes.adminAiProviders, query: { tab: each } }
            }
            aria-current={each === tab ? "page" : undefined}
            className="-mb-px border-b-2 border-transparent px-0.5 py-2.5 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:border-foreground aria-[current=page]:text-foreground"
          >
            {t(each)}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}

export { ProvidersShell, providersTab };
