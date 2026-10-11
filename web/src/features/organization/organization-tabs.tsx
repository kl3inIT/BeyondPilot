"use client";

import { useEffect, useRef } from "react";

import { Link } from "@/i18n/navigation";

type OrganizationTabsProps = {
  /** What the row of tabs is called. */
  label: string;
  tabs: { key: string; href: string; label: string; count?: number }[];
  current: string;
};

/**
 * The tabs of My organization. On a phone they are wider than the screen: the row scrolls and the
 * page does not, the edge fades where more tabs wait, and the row opens on the current tab.
 */
function OrganizationTabs({ label, tabs, current }: OrganizationTabsProps) {
  const row = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = row.current;
    const tab = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !tab) return;
    // Only the row moves: scrollIntoView would also move the page.
    const end = tab.offsetLeft + tab.offsetWidth;
    if (end > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = end - nav.clientWidth;
    else if (tab.offsetLeft < nav.scrollLeft) nav.scrollLeft = tab.offsetLeft;
  }, [current]);

  return (
    <nav
      ref={row}
      aria-label={label}
      className="relative scrollbar-none overflow-x-auto max-md:scroll-fade-x"
    >
      <div className="flex w-max min-w-full items-end gap-5 border-b">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={tab.key === current ? "page" : undefined}
            className="group -mb-px flex items-center gap-1.5 border-b-2 border-transparent px-0.5 py-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset aria-[current=page]:border-foreground aria-[current=page]:text-foreground"
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="text-xs group-aria-[current=page]:text-primary">{tab.count}</span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export { OrganizationTabs };
