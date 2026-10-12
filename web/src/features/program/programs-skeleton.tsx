import { useTranslations } from "next-intl";

import {
  DirectoryToolbarSkeleton,
  LoadingStatus,
} from "@/components/composites/directory-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/** How many programs stand in while the list is read. */
const CARDS = 3;

/**
 * Events & Programs while its list is read: the frame of `ProgramsPage` with its real title and
 * lead, the controls and a column of card shells, so nothing moves when the programs arrive.
 */
function ProgramsSkeleton() {
  const t = useTranslations("Programs");

  return (
    <div className="flex-1 bg-muted">
      <div className="mx-auto flex w-full max-w-360 flex-col gap-10 px-5 py-10 md:px-8 md:py-14 xl:px-16 desktop:px-20">
        <header className="flex max-w-2xl flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-headline md:text-5xl">{t("title")}</h1>
          <p className="text-muted-foreground md:text-lg">{t("lead")}</p>
        </header>
        <LoadingStatus />
        {/* The search and the type above, then the room of the phase tabs over their rule. */}
        <div className="flex flex-col gap-3 border-b pb-15">
          <DirectoryToolbarSkeleton filters={2} count={false} />
        </div>
        <ul aria-hidden="true" className="flex flex-col gap-4">
          {Array.from({ length: CARDS }, (_, index) => (
            <li
              key={index}
              className="flex flex-col gap-3 rounded-3xl border bg-card p-5 xl:flex-row xl:gap-8"
            >
              <Skeleton className="h-40 w-full xl:w-120" />
              <div className="flex flex-1 flex-col gap-3">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export { ProgramsSkeleton };
