import { useTranslations } from "next-intl";

import type { AccountMenuProps } from "@/components/layout/account-menu";
import { AdminAccount } from "@/components/layout/admin-account";
import { AdminNav, type AdminNavGroup } from "@/components/layout/admin-nav";
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
 * destinations it is given, in their groups, and the signed-in person at the foot.
 */
function AdminSidebar({ account, groups }: { account: AccountMenuProps; groups: AdminNavGroup[] }) {
  const t = useTranslations("Admin");
  const s = useTranslations("Site");

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
        <AdminNav label={t("nav.label")} groups={groups} />
      </SidebarContent>
      <SidebarFooter>
        <AdminAccount {...account} />
      </SidebarFooter>
      <SidebarRail aria-label={t("toggleSidebar")} title={t("toggleSidebar")} />
    </Sidebar>
  );
}

export { AdminSidebar };
