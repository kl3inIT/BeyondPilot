"use client";

import type { ReactNode } from "react";

import {
  SidebarGroup,
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

/**
 * The item of the page a person is on: the one whose address the path continues, whole segment by
 * whole segment, and the longest of those, so `/admin` is not lit on every page under it.
 */
function currentItem(items: AdminNavItem[], pathname: string) {
  return items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

/** The destinations of the admin area. Collapsed to icons, each keeps its name as a tooltip. */
function AdminNav({ label, items }: { label: string; items: AdminNavItem[] }) {
  const current = currentItem(items, usePathname());

  return (
    <SidebarGroup>
      <nav aria-label={label}>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
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
      </nav>
    </SidebarGroup>
  );
}

export { AdminNav };
export type { AdminNavItem };
