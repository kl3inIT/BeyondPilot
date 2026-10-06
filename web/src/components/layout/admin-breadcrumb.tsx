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
  /** Pages below a destination that have no sidebar entry, such as "New use case"; each is a third crumb. */
  subpages?: Pick<AdminNavItem, "href" | "label">[];
};

/** Where a person is in the admin area: the area, the destination, and a page below it when there is one. */
function AdminBreadcrumb({ area, items, subpages = [] }: AdminBreadcrumbProps) {
  const pathname = usePathname();
  const current = currentItem(items, pathname);
  const destination = current && current.href !== area.href ? current : undefined;
  const subpage = subpages.find((candidate) => candidate.href === pathname);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {destination ? (
          <>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink render={<Link href={area.href} />}>{area.label}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            {subpage ? (
              <>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink render={<Link href={destination.href} />}>
                    {destination.label}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{subpage.label}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : (
              <BreadcrumbItem>
                <BreadcrumbPage>{destination.label}</BreadcrumbPage>
              </BreadcrumbItem>
            )}
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
