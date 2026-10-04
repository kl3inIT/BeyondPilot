import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getCurrentAccount } from "@/lib/auth/session";

/**
 * The frame of the operators' area: the sidebar, a bar with its toggle, and the page. It does not
 * decide who gets in: each page does, through `requireRole`, because a layout is not rendered again
 * between its pages. For anyone the page turns away there is no frame to draw, so the page's
 * redirect or not-found answer goes out alone.
 */
export default async function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  const account = await getCurrentAccount();
  if (account?.role !== "operator") {
    return children;
  }
  const [t, s, cookieStore] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("Site"),
    cookies(),
  ]);

  return (
    // The sidebar records open or collapsed in this cookie; reading it here draws the right width
    // from the first paint.
    <SidebarProvider defaultOpen={cookieStore.get("sidebar_state")?.value !== "false"}>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
      >
        {s("skipToContent")}
      </a>
      <AdminSidebar
        account={{ name: account.displayName ?? null, email: account.email, operator: true }}
      />
      <SidebarInset id="content">
        <header className="flex h-12 shrink-0 items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" aria-label={t("toggleSidebar")} />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
