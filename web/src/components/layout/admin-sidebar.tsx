import { useTranslations } from "next-intl";

import type { AccountMenuProps } from "@/components/layout/account-menu";
import { AdminAccount } from "@/components/layout/admin-account";
import { BrandMark } from "@/components/layout/brand-mark";
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
 * destinations it is given, in their groups, and the signed-in person at the foot. A judge's Reviews
 * use it too, with their own home and name.
 */
function AdminSidebar({
  account,
  groups,
  home = siteRoutes.admin,
  area,
}: {
  account: AccountMenuProps;
  groups: AdminNavGroup[];
  /** Where the brand leads. */
  home?: string;
  /** The name of the area under the brand; the admin area's by default. */
  area?: string;
}) {
  const t = useTranslations("Admin");
  const s = useTranslations("Site");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href={home} />}>
              <BrandMark className="size-8 shrink-0 group-data-[collapsible=icon]:-m-1 group-data-[collapsible=icon]:size-6" />
              {/* The mark alone; its name and the area are read, not shown. */}
              <span className="sr-only">
                {s("brand")}, {area ?? t("title")}
              </span>
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
