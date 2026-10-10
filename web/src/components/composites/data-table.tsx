import { cn } from "cn";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";

/**
 * The frame every list of the application shares. A list is read by a Server Component from the
 * parameters of the URL and drawn with the registry table inside this frame; nothing here fetches
 * or keeps state (docs/conventions.md › Lists). The header row sits on the muted ground, and the
 * first and last columns keep the 20px inset of the cards around the list.
 */
function DataTable({ className, ...props }: React.ComponentProps<typeof Table>) {
  return (
    <div
      data-slot="data-table"
      className={cn(
        "overflow-hidden rounded-lg border [&_td:first-child]:pl-5 [&_td:last-child]:pr-5 [&_th:first-child]:pl-5 [&_th:last-child]:pr-5 [&_thead]:bg-muted",
        className,
      )}
    >
      <Table {...props} />
    </div>
  );
}

type DataTableEmptyProps = {
  icon: React.ReactNode;
  title: string;
  /** A line under the title, only when it says what the title and the action do not. */
  description?: string;
  /** The one action that leads out of this state, for example clearing the search and filters. */
  children?: React.ReactNode;
};

/**
 * What a list shows in place of its rows: a search that found nothing, or a list with nothing in it
 * yet. The two are different states with their own words.
 */
function DataTableEmpty({ icon, title, description, children }: DataTableEmptyProps) {
  return (
    <Empty data-slot="data-table-empty">
      <EmptyHeader>
        <EmptyMedia>{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  );
}

/** The pages to offer around the current one: the first, the last, the neighbours, and gaps between. */
function pagesAround(current: number, last: number): (number | "gap")[] {
  const shown = [1, current - 1, current, current + 1, last].filter(
    (page, index, all) => page >= 1 && page <= last && all.indexOf(page) === index,
  );
  return shown.flatMap((page, index) =>
    index > 0 && page - shown[index - 1] > 1 ? (["gap", page] as const) : [page],
  );
}

type DataTableFooterProps = {
  /** How many records match, already worded: "8 accounts". */
  count: string;
  /** The current page, counted from 1, and the last one. */
  page: number;
  pages: number;
  /** The address of a page, already carrying the search and filters; the link adds the locale. */
  href: (page: number) => string;
  labels: {
    /** The name of the paging navigation for assistive technology. */
    navigation: string;
    previous: string;
    next: string;
    goToPrevious: string;
    goToNext: string;
    page: (page: number) => string;
  };
};

/**
 * Under a list: how many records match, and the registry pagination when they fill more than one
 * page. A way that does not exist, back from the first page or on from the last, is not offered.
 */
function DataTableFooter({ count, page, pages, href, labels }: DataTableFooterProps) {
  return (
    <div
      data-slot="data-table-footer"
      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
    >
      <p className="text-sm text-muted-foreground">{count}</p>
      {pages > 1 && (
        <Pagination aria-label={labels.navigation} className="mx-0 w-auto">
          <PaginationContent>
            {page > 1 && (
              <PaginationItem>
                <PaginationPrevious
                  href={href(page - 1)}
                  text={labels.previous}
                  aria-label={labels.goToPrevious}
                />
              </PaginationItem>
            )}
            {pagesAround(page, pages).map((entry, index) =>
              entry === "gap" ? (
                <PaginationItem key={`gap-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={entry}>
                  <PaginationLink
                    href={href(entry)}
                    isActive={entry === page}
                    aria-label={labels.page(entry)}
                  >
                    {entry}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            {page < pages && (
              <PaginationItem>
                <PaginationNext
                  href={href(page + 1)}
                  text={labels.next}
                  aria-label={labels.goToNext}
                />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

type DataTablePagerProps = {
  /** The address of the page towards the start of the list; absent on the first page. */
  previous?: string;
  /** The address of the page towards its end; absent on the last page. */
  next?: string;
  labels: Pick<
    DataTableFooterProps["labels"],
    "navigation" | "previous" | "next" | "goToPrevious" | "goToNext"
  >;
};

/**
 * Under a list that only grows and is read from its newest end: the way to the page before and
 * after, without a count or page numbers, because a total would move under the reader. Nothing is
 * drawn for a list that fits one page.
 */
function DataTablePager({ previous, next, labels }: DataTablePagerProps) {
  if (!previous && !next) {
    return null;
  }
  return (
    <div data-slot="data-table-pager" className="flex justify-end">
      <Pagination aria-label={labels.navigation} className="mx-0 w-auto">
        <PaginationContent>
          {previous && (
            <PaginationItem>
              <PaginationPrevious
                href={previous}
                text={labels.previous}
                aria-label={labels.goToPrevious}
              />
            </PaginationItem>
          )}
          {next && (
            <PaginationItem>
              <PaginationNext href={next} text={labels.next} aria-label={labels.goToNext} />
            </PaginationItem>
          )}
        </PaginationContent>
      </Pagination>
    </div>
  );
}

export { DataTable, DataTableEmpty, DataTableFooter, DataTablePager };
