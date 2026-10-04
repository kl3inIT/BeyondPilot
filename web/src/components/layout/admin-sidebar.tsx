import { HouseIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { AccountMenuProps } from "@/components/layout/account-menu";
import { AdminAccount } from "@/components/layout/admin-account";
import { AdminNav, type AdminNavItem } from "@/components/layout/admin-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Link } from "@/i18n/navigation";
import { siteRoutes } from "@/lib/site";

/**
 * The admin area's sidebar, the stock shadcn one that collapses to icons: the brand, the
 * destinations, and the signed-in person at the foot. A destination is listed here once its screen
 * exists.
 */
function AdminSidebar({ account }: { account: AccountMenuProps }) {
  const t = useTranslations("Admin");
  const s = useTranslations("Site");
  const items: AdminNavItem[] = [
    { href: siteRoutes.admin, label: t("nav.home"), icon: <HouseIcon aria-hidden="true" /> },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href={siteRoutes.admin} />}>
              <div
                aria-hidden="true"
                className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
              >
                {s("brand").charAt(0)}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{s("brand")}</span>
                <span className="truncate text-xs">{t("title")}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <AdminNav label={t("nav.label")} items={items} />
      </SidebarContent>
      <SidebarFooter>
        <AdminAccount {...account} />
      </SidebarFooter>
      <SidebarRail aria-label={t("toggleSidebar")} title={t("toggleSidebar")} />
    </Sidebar>
  );
}

export { AdminSidebar };
