import { getTranslations } from "next-intl/server";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentAccount } from "@/lib/auth/session";

/**
 * The frame of a person's own pages: the site's header and footer around the page. It does not
 * decide who gets in: each page does, through `requireAccount`. For a visitor the page redirects to
 * sign in, and that answer goes out without a frame.
 */
async function WorkspaceFrame({ children }: { children: React.ReactNode }) {
  const account = await getCurrentAccount();
  if (!account) {
    return children;
  }
  const t = await getTranslations("Site");

  return (
    <>
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
    </>
  );
}

export { WorkspaceFrame };
