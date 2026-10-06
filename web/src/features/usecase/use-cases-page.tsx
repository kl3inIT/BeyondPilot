import { SearchXIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createSerializer } from "nuqs/server";

import { Button } from "@/components/actions/button";
import { DataTableEmpty, DataTableFooter } from "@/components/composites/data-table";
import { Section } from "@/components/ui/section";
import { siteRoutes } from "@/lib/site";

import { UseCaseCard } from "./use-case-card";
import type { UseCaseList } from "./use-cases-queries";
import { useCasesSearch, type UseCasesSearch } from "./use-cases-search";
import { UseCasesToolbar } from "./use-cases-toolbar";

const address = createSerializer(useCasesSearch);

type UseCasesPageProps = {
  useCases: UseCaseList;
  search: UseCasesSearch;
};

/**
 * Use cases: the business problems enterprises have published, one card each. The list arrives
 * already read; search, industry, order and paging are the URL.
 */
async function UseCasesPage({ useCases, search }: UseCasesPageProps) {
  const t = await getTranslations("UseCases");
  const pages = Math.max(1, Math.ceil(useCases.total / useCases.pageSize));
  /** The address of a page of this list, with the search, industry and order kept. */
  const pageHref = (number: number) => address(siteRoutes.useCases, { ...search, page: number });

  return (
    <Section surface="muted" className="flex-1">
      <div className="flex flex-col gap-6 py-10 md:gap-7 md:py-14">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-headline md:text-headline">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">{t("lead")}</p>
        </div>
        <UseCasesToolbar />

        {useCases.items.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {useCases.items.map((useCase) => (
              <UseCaseCard key={useCase.id} useCase={useCase} />
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border bg-card">
            <DataTableEmpty
              icon={<SearchXIcon aria-hidden="true" />}
              title={t("empty.title")}
              description={t("empty.description")}
            >
              <Button prominence="secondary" size="sm" href={siteRoutes.useCases}>
                {t("empty.clear")}
              </Button>
            </DataTableEmpty>
          </div>
        )}

        <DataTableFooter
          count={t("count", { count: useCases.total })}
          page={useCases.page}
          pages={pages}
          href={pageHref}
          labels={{
            navigation: t("pagination.label"),
            previous: t("pagination.previous"),
            next: t("pagination.next"),
            goToPrevious: t("pagination.goToPrevious"),
            goToNext: t("pagination.goToNext"),
            page: (number) => t("pagination.page", { page: number }),
          }}
        />

        <div className="flex flex-col gap-4 rounded-2xl bg-accent p-5 md:flex-row md:items-center md:justify-between md:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">{t("publish.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("publish.description")}</p>
          </div>
          <Button prominence="secondary" size="lg" href={siteRoutes.publishUseCase}>
            {t("publish.action")}
          </Button>
        </div>
      </div>
    </Section>
  );
}

export { UseCasesPage };
