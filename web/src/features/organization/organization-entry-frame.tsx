import { ArrowLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { siteRoutes } from "@/lib/site";

/**
 * The frame of the ways into an organization, under the site's header: one narrow column, and the
 * way back to the site beneath it.
 */
function OrganizationEntryFrame({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Organization.entry");

  return (
    <div className="flex flex-1 flex-col items-center gap-10 px-5 pt-8 pb-12 md:px-8 md:pt-22 md:pb-24">
      {children}
      <Link
        href={siteRoutes.home}
        className="hit-area inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        {t("back")}
      </Link>
    </div>
  );
}

export { OrganizationEntryFrame };
