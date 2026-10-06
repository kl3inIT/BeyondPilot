import {
  BoxesIcon,
  BuildingIcon,
  CalendarRangeIcon,
  HouseIcon,
  LightbulbIcon,
  PlugZapIcon,
  ScanSearchIcon,
  ScrollTextIcon,
  UserCogIcon,
  HandshakeIcon,
  MailIcon,
  UsersIcon,
} from "lucide-react";
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

  // The destinations of the admin area in the sidebar's groups: what GenAI Fund reviews, the AI
  // services BeyondPilot calls, then the system's own records. One is listed here by the change
  // that adds its screen.
  const groups: AdminNavGroup[] = [
    {
      items: [
        { href: siteRoutes.admin, label: t("nav.home"), icon: <HouseIcon aria-hidden="true" /> },
      ],
    },
    {
      label: t("nav.review"),
      items: [
        {
          href: siteRoutes.adminPrograms,
          label: t("nav.programs"),
          icon: <CalendarRangeIcon aria-hidden="true" />,
        },
        {
          href: siteRoutes.adminUseCases,
          label: t("nav.useCases"),
          icon: <LightbulbIcon aria-hidden="true" />,
        },
        {
          href: siteRoutes.adminSolutions,
          label: t("nav.solutions"),
          icon: <BoxesIcon aria-hidden="true" />,
        },
        {
          href: siteRoutes.adminTalent,
          label: t("nav.talent"),
          icon: <UsersIcon aria-hidden="true" />,
        },
        {
          href: siteRoutes.adminOrganizations,
          label: t("nav.organizations"),
          icon: <BuildingIcon aria-hidden="true" />,
        },
        {
          href: siteRoutes.adminIntroductions,
          label: t("nav.introductions"),
          icon: <HandshakeIcon aria-hidden="true" />,
        },
      ],
    },
    {
      label: t("nav.ai"),
      items: [
        {
          href: siteRoutes.adminAiProviders,
          label: t("nav.aiProviders"),
          icon: <PlugZapIcon aria-hidden="true" />,
        },
        {
          href: siteRoutes.adminSearchIndex,
          label: t("nav.searchIndex"),
          icon: <ScanSearchIcon aria-hidden="true" />,
        },
      ],
    },
    {
      label: t("nav.system"),
      items: [
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
        {
          href: siteRoutes.adminEmail,
          label: t("nav.email"),
          icon: <MailIcon aria-hidden="true" />,
        },
      ],
    },
  ];
  const destinations = groups.flatMap((group) => group.items);

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
        groups={groups}
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
            subpages={[{ href: siteRoutes.adminUseCasesNew, label: t("nav.useCasesNew") }]}
          />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
