import { useTranslations } from "next-intl";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { MessageScope } from "@/i18n/message-scope";

/** The public site around a page: the skip link, the header, the page as `main`, the footer. */
function PublicFrame({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Site");

  return (
    <MessageScope area="public">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
      >
        {t("skipToContent")}
      </a>
      <SiteHeader />
      <main id="content" className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter />
    </MessageScope>
  );
}

export { PublicFrame };
