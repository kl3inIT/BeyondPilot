"use client";

import { useAdminCrumb } from "@/components/layout/admin-crumb";
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
import { cn } from "@/lib/utils";

type AdminBreadcrumbProps = {
  /** The admin area itself, the first crumb. */
  area: { href: string; label: string };
  /**
   * The destinations of the sidebar; the one the path belongs to is the second crumb. Its icon leads the title
   * a narrow screen shows in place of the crumbs.
   */
  items: (Pick<AdminNavItem, "href" | "label"> & Partial<Pick<AdminNavItem, "icon">>)[];
  /** Pages below a destination that have no sidebar entry, such as "New use case"; each is a third crumb. */
  subpages?: Pick<AdminNavItem, "href" | "label">[];
};

/**
 * Where a person is in the admin area: the area, the destination, and a page below it when there is one. That
 * page is one the frame knows by its address (`subpages`), or one that names itself: a record's page, by the
 * record (`AdminCrumb`, which `AdminPageHeader` writes). A narrow screen has room for one of them only, so there
 * it is drawn as the page's title, after the destination's icon, and `AdminPageTitle` does not repeat it below;
 * a page that names itself shows its destination there, since its own title stands right under the bar.
 */
function AdminBreadcrumb({ area, items, subpages = [] }: AdminBreadcrumbProps) {
  const pathname = usePathname();
  const current = currentItem(items, pathname);
  const destination = current && current.href !== area.href ? current : undefined;
  const subpage = subpages.find((candidate) => candidate.href === pathname);
  const named = useAdminCrumb();
  // The last crumb of a page below a destination. On the destination's own page nothing follows it.
  const below = subpage?.label ?? (destination && pathname !== destination.href ? named : null);
  const icon = current?.icon;

  return (
    <>
      {icon && (
        <p className="flex items-center gap-2 text-lg font-semibold md:hidden">
          <span className="text-muted-foreground [&>svg]:size-5">{icon}</span>
          {(subpage ?? destination ?? area).label}
        </p>
      )}
      <Breadcrumb className={cn(icon && "max-md:hidden")}>
        <BreadcrumbList>
          {destination ? (
            <>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink render={<Link href={area.href} />}>{area.label}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              {below ? (
                <>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink render={<Link href={destination.href} />}>
                      {destination.label}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem className="min-w-0">
                    {/* A record's name can be long; the title under the bar says it in full. */}
                    <BreadcrumbPage className="min-w-0">
                      <span className="block max-w-80 truncate">{below}</span>
                    </BreadcrumbPage>
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
    </>
  );
}

export { AdminBreadcrumb };
