import { useTranslations } from "next-intl";

import {
  DirectoryToolbarSkeleton,
  LoadingStatus,
} from "@/components/composites/directory-skeleton";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";

/** How many use cases stand in while the list is read. */
const CARDS = 4;

/**
 * The use cases directory while its list is read: the frame of `UseCasesPage` with its real title
 * and lead, the toolbar and a column of card shells, so nothing moves when the use cases arrive.
 */
function UseCasesSkeleton() {
  const t = useTranslations("UseCases");

  return (
    <Section surface="muted" className="flex-1">
      <div className="flex flex-col gap-6 py-10 md:gap-7 md:py-14">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-headline md:text-headline">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">{t("lead")}</p>
        </div>
        <LoadingStatus />
        <DirectoryToolbarSkeleton filters={2} />
        <ul aria-hidden="true" className="flex flex-col gap-4">
          {Array.from({ length: CARDS }, (_, index) => (
            <li
              key={index}
              className="flex flex-col gap-3 rounded-2xl border bg-card p-4 md:gap-4 md:p-5"
            >
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

export { UseCasesSkeleton };
