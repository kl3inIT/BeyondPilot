import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type PageTab = {
  key: string;
  /** What the tab is called. */
  label: React.ReactNode;
  /** The page it opens, with the query parameters it keeps, such as a period. */
  href: React.ComponentProps<typeof Link>["href"];
  /** A count beside the label, such as how many records the page holds; nothing when it is left out. */
  count?: number;
};

type PageTabsProps = {
  /** What the row of tabs is, for assistive technology. */
  label: string;
  tabs: readonly PageTab[];
  /** The key of the page on the screen. */
  current: string;
  className?: string;
};

/**
 * The pages of one place, as a row of links under its head (docs/conventions.md › Admin page frame),
 * as Dub's `PageNavTabs` are: each tab is its own address, the one on the screen is marked for
 * assistive technology, and a row wider than the screen scrolls with its edge faded where tabs wait.
 * Every tab keeps one weight, so the row does not shift when another is chosen.
 */
function PageTabs({ label, tabs, current, className }: PageTabsProps) {
  return (
    <nav
      aria-label={label}
      data-slot="page-tabs"
      className={cn("relative scrollbar-none overflow-x-auto max-md:scroll-fade-x", className)}
    >
      <ul className="flex w-max min-w-full items-end gap-5 border-b">
        {tabs.map((tab) => (
          <li key={tab.key}>
            <Link
              href={tab.href}
              aria-current={tab.key === current ? "page" : undefined}
              className="group -mb-px inline-flex min-h-11 items-center gap-1.5 border-b-2 border-transparent px-0.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors duration-fast outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset aria-[current=page]:border-foreground aria-[current=page]:text-foreground"
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="text-xs tabular-nums group-aria-[current=page]:text-primary">
                  {tab.count}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export { PageTabs, type PageTab };
