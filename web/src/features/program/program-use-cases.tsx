import { getTranslations } from "next-intl/server";

import { UseCaseCard } from "@/features/usecase/use-case-card";
import type { UseCaseList } from "@/features/usecase/use-cases-queries";
import { Link } from "@/i18n/navigation";
import { siteRoutes } from "@/lib/site";

/**
 * The use cases an operator attached to a program, one card each, as the Use cases list shows them.
 * A page renders it, and names it in its navigation, only when the program has any.
 */
async function ProgramUseCases({
  useCases,
  title,
  lead,
}: {
  useCases: UseCaseList;
  title: string;
  lead: string;
}) {
  const t = await getTranslations("Program.page.useCases");

  return (
    <section id="use-cases" className="flex scroll-mt-6 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-title md:text-3xl">{title}</h2>
        <p className="max-w-3xl text-muted-foreground">{lead}</p>
      </div>
      <ul className="flex flex-col gap-4 md:gap-6">
        {useCases.items.map((useCase) => (
          <UseCaseCard key={useCase.id} useCase={useCase} heading="h3" />
        ))}
      </ul>
      {useCases.total > useCases.items.length && (
        <p className="text-sm text-muted-foreground">
          {t("shown", { shown: useCases.items.length, total: useCases.total })}{" "}
          <Link
            href={siteRoutes.useCases}
            className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
          >
            {t("all")}
          </Link>
        </p>
      )}
    </section>
  );
}

export { ProgramUseCases };
