import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

/** How many cards stand in for a page of a directory: two rows of the widest grid. */
const CARDS = 6;

/** Says that a page is loading to assistive technology; the blocks beside it are hidden from it. */
function LoadingStatus() {
  const t = useTranslations("Site");

  return (
    <span role="status" className="sr-only">
      {t("loading")}
    </span>
  );
}

type DirectoryToolbarSkeletonProps = {
  /** How many filters and orders follow the search. */
  filters: number;
  /** Whether the directory counts under its controls; one that counts elsewhere has no such line. */
  count?: boolean;
};

/**
 * `DirectoryToolbar` while its list is read: the search and the filters as empty fields of the
 * same height, and the line of the count.
 */
function DirectoryToolbarSkeleton({ filters, count = true }: DirectoryToolbarSkeletonProps) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="h-12 w-full rounded-lg border border-input bg-background xl:min-w-56 xl:flex-1" />
        <div className="flex flex-col gap-3 md:flex-row md:items-center xl:shrink-0">
          {Array.from({ length: filters }, (_, index) => (
            <div
              key={index}
              className="h-12 w-full rounded-lg border border-input bg-background md:w-44"
            />
          ))}
        </div>
      </div>
      {count && (
        <div className="flex min-h-8 items-center">
          <Skeleton className="h-4 w-32" />
        </div>
      )}
    </div>
  );
}

type DirectoryGridSkeletonProps = {
  /** The directory's own title and lead, which are known before its list is. */
  title: string;
  lead: string;
  filters: number;
  /** The cards open with a picture, as a solution's do. */
  media?: boolean;
};

/**
 * A public directory of cards while its list is read: the frame the solutions and talent
 * directories share, with their real title and lead, the toolbar and a grid of card shells, so
 * nothing moves when the cards arrive.
 */
function DirectoryGridSkeleton({ title, lead, filters, media }: DirectoryGridSkeletonProps) {
  return (
    <div className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-5 px-5 pt-8 pb-18 md:gap-7 md:px-8 md:pt-12 md:pb-22 xl:px-16 xl:pt-14 xl:pb-24 desktop:px-20">
      <header className="flex flex-col gap-2.5">
        <h1 className="text-3xl font-semibold tracking-title md:text-4xl xl:text-5xl xl:leading-none">
          {title}
        </h1>
        <p className="max-w-180 text-base text-muted-foreground md:text-lg">{lead}</p>
      </header>
      <LoadingStatus />
      <DirectoryToolbarSkeleton filters={filters} />
      <ul aria-hidden="true" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: CARDS }, (_, index) => (
          <li
            key={index}
            className="flex min-w-0 flex-1 flex-col gap-4 rounded-2xl border bg-card p-5"
          >
            {media && <Skeleton className="h-35 w-full" />}
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export { DirectoryGridSkeleton, DirectoryToolbarSkeleton, LoadingStatus };
