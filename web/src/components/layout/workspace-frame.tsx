import { getTranslations } from "next-intl/server";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentAccount } from "@/lib/auth/session";

type WorkspaceFrameProps = {
  children: React.ReactNode;
  /**
   * For a page that is an application of its own, such as Messages: the page takes the height of
   * the screen under the header and scrolls inside itself, so there is no footer to reach.
   */
  fill?: boolean;
};

/**
 * The frame of a person's own pages: the site's header and footer around the page. It does not
 * decide who gets in: each page does, through `requireAccount`. For a visitor the page redirects to
 * sign in, and that answer goes out without a frame.
 */
async function WorkspaceFrame({ children, fill = false }: WorkspaceFrameProps) {
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
      {fill ? (
        <div className="flex h-dvh flex-col">
          <SiteHeader />
          <main id="content" className="flex min-h-0 flex-1 flex-col bg-muted">
            {children}
          </main>
        </div>
      ) : (
        <>
          <SiteHeader />
          <main id="content" className="flex flex-1 flex-col">
            {children}
          </main>
          <SiteFooter />
        </>
      )}
    </>
  );
}

export { WorkspaceFrame };
