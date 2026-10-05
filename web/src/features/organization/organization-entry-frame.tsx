import { ArrowLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { BrandLockup } from "@/components/layout/brand-lockup";
import { Link } from "@/i18n/navigation";
import { siteRoutes } from "@/lib/site";

/**
 * The frame of the ways into an organization: the brand, the way back, and one narrow column. The
 * site navigation is left out on purpose, as on the sign-in screens, so nothing pulls a person away
 * mid-way.
 */
function OrganizationEntryFrame({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Organization.entry");
  const s = useTranslations("Site");

  return (
    <div className="flex flex-1 flex-col bg-background">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
      >
        {s("skipToContent")}
      </a>
      <header className="flex items-center justify-between gap-4 px-5 py-5 md:px-8 lg:px-16">
        <BrandLockup showPoweredBy={false} />
        <Link
          href={siteRoutes.home}
          className="hit-area inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          {t("back")}
        </Link>
      </header>
      <main
        id="content"
        className="flex flex-1 justify-center px-5 pt-8 pb-12 md:px-8 md:pt-22 md:pb-24"
      >
        {children}
      </main>
    </div>
  );
}

export { OrganizationEntryFrame };
