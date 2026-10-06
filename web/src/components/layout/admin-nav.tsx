"use client";

import { useId, type ReactNode } from "react";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Link, usePathname } from "@/i18n/navigation";

type AdminNavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

type AdminNavGroup = {
  /** What the destinations have in common, above them; none for the ones that lead the list. */
  label?: string;
  items: AdminNavItem[];
};

/**
 * The item of the page a person is on: the one whose address the path continues, whole segment by
 * whole segment, and the longest of those, so `/admin` is not lit on every page under it.
 */
function currentItem<Item extends Pick<AdminNavItem, "href">>(items: Item[], pathname: string) {
  return items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

/** One group of destinations, under its label when it has one. */
function AdminNavSection({ group, current }: { group: AdminNavGroup; current?: AdminNavItem }) {
  const labelId = useId();

  return (
    <>
      {group.label && (
        // Collapsed to icons there is no room for a label, and it must not cover the button above.
        <SidebarGroupLabel id={labelId} className="mt-3 group-data-[collapsible=icon]:hidden">
          {group.label}
        </SidebarGroupLabel>
      )}
      <SidebarMenu aria-labelledby={group.label ? labelId : undefined}>
        {group.items.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              size="md"
              isActive={item === current}
              tooltip={item.label}
              render={
                <Link href={item.href} aria-current={item === current ? "page" : undefined} />
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </>
  );
}

/**
 * The destinations of the admin area, in their groups. Collapsed to icons, the group labels go and
 * each destination keeps its name as a tooltip.
 */
function AdminNav({ label, groups }: { label: string; groups: AdminNavGroup[] }) {
  const current = currentItem(
    groups.flatMap((group) => group.items),
    usePathname(),
  );

  return (
    <SidebarGroup>
      <nav aria-label={label} className="flex flex-col gap-1">
        {groups.map((group) => (
          <AdminNavSection key={group.items[0].href} group={group} current={current} />
        ))}
      </nav>
    </SidebarGroup>
  );
}

export { AdminNav, currentItem };
export type { AdminNavGroup, AdminNavItem };
