import { LoadingStatus } from "@/components/composites/directory-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/** How many result rows stand in while the search is read. */
const ROWS = 6;

/**
 * The search page while its results are read: the same column as `SearchPage`, with blocks where
 * the field, the count, the tabs and the rows of results come, so nothing moves when they arrive.
 */
function SearchSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-360 flex-1 flex-col px-5 pt-6 pb-18 md:px-8 md:pt-10 md:pb-22 xl:px-16 desktop:px-20">
      <LoadingStatus />
      <div aria-hidden="true" className="flex w-full max-w-220 flex-col gap-6">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-13 w-full" />
          <Skeleton className="h-5 w-56" />
        </div>
        <div className="flex gap-6 border-b md:gap-7">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex min-h-11 items-center">
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {Array.from({ length: ROWS }, (_, index) => (
            <li key={index} className="flex gap-3 px-4 py-3.5 md:gap-4 md:px-5 md:py-4">
              <Skeleton className="size-12 shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-full" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export { SearchSkeleton };
