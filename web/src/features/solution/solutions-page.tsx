import { BoxesIcon, SearchXIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { createSerializer } from "nuqs/server";

import { Button } from "@/components/actions/button";
import { DataTableEmpty } from "@/components/composites/data-table";
import { ListFooter } from "@/components/composites/list-footer";
import type { PublicSolutionList } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { SolutionCard } from "./solution-card";
import { solutionsSearch, type SolutionsSearch } from "./solutions-search";
import { SolutionsToolbar } from "./solutions-toolbar";

const address = createSerializer(solutionsSearch);

type SolutionsPageProps = {
  solutions: PublicSolutionList;
  search: SolutionsSearch;
};

/**
 * AI solutions: the public directory of what GenAI Fund approved, by name. The list arrives already
 * read; search, the facets and paging are the URL.
 */
function SolutionsPage({ solutions, search }: SolutionsPageProps) {
  const t = useTranslations("Solution.directory");
  const filtered =
    search.q.trim() !== "" ||
    search.industry !== null ||
    search.focusArea !== null ||
    search.maturity !== null;
  const shown = solutions.items.length;

  return (
    <div className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-5 px-5 pt-8 pb-18 md:gap-7 md:px-8 md:pt-12 md:pb-22 xl:px-16 xl:pt-14 xl:pb-24 desktop:px-20">
      <header className="flex flex-col gap-2.5">
        <h1 className="text-3xl font-semibold tracking-title md:text-4xl xl:text-5xl xl:leading-none">
          {t("title")}
        </h1>
        <p className="max-w-180 text-base text-muted-foreground md:text-lg">{t("lead")}</p>
      </header>
      <SolutionsToolbar
        list="directory"
        count={shown > 0 ? t("showing", { shown, total: solutions.total }) : null}
      />

      {shown > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {solutions.items.map((solution) => (
            <li key={solution.slug} className="flex min-w-0">
              <SolutionCard solution={solution} />
            </li>
          ))}
        </ul>
      ) : filtered ? (
        <DataTableEmpty
          icon={<SearchXIcon aria-hidden="true" />}
          title={t("noMatch.title")}
          description={t("noMatch.description")}
        >
          <Button prominence="secondary" size="sm" href={siteRoutes.solutions}>
            {t("noMatch.clear")}
          </Button>
        </DataTableEmpty>
      ) : (
        <DataTableEmpty
          icon={<BoxesIcon aria-hidden="true" />}
          title={t("empty.title")}
          description={t("empty.description")}
        />
      )}

      {solutions.total > solutions.pageSize && (
        <ListFooter
          count={t("count", { count: solutions.total })}
          page={solutions.page}
          pageSize={solutions.pageSize}
          total={solutions.total}
          href={(page) => address(siteRoutes.solutions, { ...search, page })}
        />
      )}

      <section className="flex flex-col gap-4 rounded-2xl bg-accent p-5 md:flex-row md:items-center md:justify-between md:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{t("strip.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("strip.body")}</p>
        </div>
        <Button
          prominence="secondary"
          size="lg"
          href={siteRoutes.workspaceSolutions}
          className="w-full md:w-auto"
        >
          {t("list")}
        </Button>
      </section>
    </div>
  );
}

export { SolutionsPage };
