import { HouseIcon, ScrollTextIcon, UserCogIcon } from "lucide-react";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { AdminBreadcrumb } from "@/components/layout/admin-breadcrumb";
import type { AdminNavItem } from "@/components/layout/admin-nav";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getCurrentAccount } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

/**
 * The frame of the operators' area: the sidebar, a bar with its toggle and the breadcrumb, and the page. It does not
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

  // The destinations of the admin area, for the sidebar and the breadcrumb. One is listed here by
  // the change that adds its screen.
  const destinations: AdminNavItem[] = [
    { href: siteRoutes.admin, label: t("nav.home"), icon: <HouseIcon aria-hidden="true" /> },
    {
      href: siteRoutes.adminAccounts,
      label: t("nav.accounts"),
      icon: <UserCogIcon aria-hidden="true" />,
    },
    {
      href: siteRoutes.adminAuditLog,
      label: t("nav.auditLog"),
      icon: <ScrollTextIcon aria-hidden="true" />,
    },
  ];

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
        items={destinations}
      />
      <SidebarInset id="content">
        <header className="flex h-12 shrink-0 items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" aria-label={t("toggleSidebar")} />
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
          />
          <AdminBreadcrumb
            area={{ href: siteRoutes.admin, label: t("title") }}
            items={destinations.map(({ href, label }) => ({ href, label }))}
          />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
