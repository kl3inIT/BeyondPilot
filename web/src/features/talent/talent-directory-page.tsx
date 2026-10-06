import { SearchXIcon, UserSearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { createSerializer } from "nuqs/server";

import { Button } from "@/components/actions/button";
import { DataTableEmpty } from "@/components/composites/data-table";
import { ListFooter } from "@/components/composites/list-footer";
import type { PublicTalentList } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { TalentCard } from "./talent-card";
import { TalentFilters } from "./talent-filters";
import { talentSearch, type TalentSearch } from "./talent-search";

const address = createSerializer(talentSearch);

type TalentDirectoryPageProps = {
  talent: PublicTalentList;
  search: TalentSearch;
  /** True when the visitor is signed in and has a talent profile. */
  hasProfile: boolean;
};

/**
 * AI talent: the public directory of the people GenAI Fund approved, on the template the directories
 * of use cases and solutions share. The list arrives already read; search, the chips, the facets and
 * paging are the URL.
 */
function TalentDirectoryPage({ talent, search, hasProfile }: TalentDirectoryPageProps) {
  const t = useTranslations("Talent.directory");
  const filtered =
    search.q.trim() !== "" ||
    search.role !== null ||
    search.availability !== null ||
    search.engagement !== null ||
    search.country !== null;
  const shown = talent.items.length;

  return (
    <div className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-5 px-5 pt-8 pb-18 md:gap-7 md:px-8 md:pt-12 md:pb-22 xl:px-16 xl:pt-14 xl:pb-24">
      <header className="flex flex-col gap-2.5">
        <h1 className="text-3xl font-semibold tracking-title md:text-4xl xl:text-5xl xl:leading-none">
          {t("title")}
        </h1>
        <p className="max-w-180 text-base text-muted-foreground md:text-lg">{t("lead")}</p>
      </header>

      {talent.total === 0 && !filtered ? (
        <DataTableEmpty
          icon={<UserSearchIcon aria-hidden="true" />}
          title={t("empty.title")}
          description={t("empty.description")}
        >
          <Button prominence="secondary" size="sm" href={siteRoutes.talentProfile}>
            {t(hasProfile ? "edit" : "create")}
          </Button>
        </DataTableEmpty>
      ) : (
        <>
          <TalentFilters count={shown > 0 ? t("count", { shown, total: talent.total }) : null} />
          {shown > 0 ? (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {talent.items.map((person) => (
                <li key={person.slug} className="flex min-w-0">
                  <TalentCard person={person} />
                </li>
              ))}
            </ul>
          ) : (
            <DataTableEmpty
              icon={<SearchXIcon aria-hidden="true" />}
              title={t("noMatch.title")}
              description={t("noMatch.description")}
            >
              <Button prominence="secondary" size="sm" href={siteRoutes.talent}>
                {t("noMatch.clear")}
              </Button>
            </DataTableEmpty>
          )}
          {talent.total > talent.pageSize && (
            <ListFooter
              count={t("total", { count: talent.total })}
              page={talent.page}
              pageSize={talent.pageSize}
              total={talent.total}
              href={(page) => address(siteRoutes.talent, { ...search, page })}
            />
          )}
        </>
      )}

      <section
        aria-labelledby="talent-join"
        className="flex flex-col gap-4 rounded-2xl bg-accent p-5 md:flex-row md:items-center md:justify-between md:p-6"
      >
        <div className="flex flex-col gap-1">
          <h2 id="talent-join" className="text-lg font-semibold">
            {t("strip.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("strip.body")}</p>
        </div>
        <Button
          prominence="secondary"
          size="lg"
          href={siteRoutes.talentProfile}
          className="w-full md:w-auto"
        >
          {t(hasProfile ? "edit" : "create")}
        </Button>
      </section>
    </div>
  );
}

export { TalentDirectoryPage };
