import { ClipboardCheckIcon } from "lucide-react";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { AdminBreadcrumb } from "@/components/layout/admin-breadcrumb";
import type { AdminNavGroup } from "@/components/layout/admin-nav";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getCurrentAccount } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

/**
 * The frame of a judge's Reviews: the admin area's sidebar with one destination, the programs they
 * score. Like the admin area it does not decide who gets in; each page asks the backend, which
 * answers only for the programs the person was invited to.
 */
export default async function ReviewsLayout({ children }: LayoutProps<"/[locale]/reviews">) {
  const account = await getCurrentAccount();
  if (!account) {
    return children;
  }
  const [t, a, s, cookieStore] = await Promise.all([
    getTranslations("Review"),
    getTranslations("Admin"),
    getTranslations("Site"),
    cookies(),
  ]);
  const groups: AdminNavGroup[] = [
    {
      items: [
        {
          href: siteRoutes.reviews,
          label: t("nav"),
          icon: <ClipboardCheckIcon aria-hidden="true" />,
        },
      ],
    },
  ];

  return (
    <SidebarProvider defaultOpen={cookieStore.get("sidebar_state")?.value !== "false"}>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
      >
        {s("skipToContent")}
      </a>
      <AdminSidebar
        account={{
          name: account.displayName ?? null,
          email: account.email,
          operator: account.role === "operator",
        }}
        groups={groups}
        home={siteRoutes.reviews}
        area={t("area")}
      />
      <SidebarInset id="content">
        <header className="flex h-12 shrink-0 items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" aria-label={a("toggleSidebar")} />
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
          />
          <AdminBreadcrumb area={{ href: siteRoutes.reviews, label: t("nav") }} items={[]} />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
