"use client";

import { currentItem, type AdminNavItem } from "@/components/layout/admin-nav";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link, usePathname } from "@/i18n/navigation";

type AdminBreadcrumbProps = {
  /** The admin area itself, the first crumb. */
  area: { href: string; label: string };
  /** The destinations of the sidebar; the one the path belongs to is the second crumb. */
  items: Pick<AdminNavItem, "href" | "label">[];
};

/** Where a person is in the admin area: the area, then the destination the page belongs to. */
function AdminBreadcrumb({ area, items }: AdminBreadcrumbProps) {
  const current = currentItem(items, usePathname());
  const destination = current && current.href !== area.href ? current : undefined;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {destination ? (
          <>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink render={<Link href={area.href} />}>{area.label}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>{destination.label}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : (
          <BreadcrumbItem>
            <BreadcrumbPage>{area.label}</BreadcrumbPage>
          </BreadcrumbItem>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export { AdminBreadcrumb };
