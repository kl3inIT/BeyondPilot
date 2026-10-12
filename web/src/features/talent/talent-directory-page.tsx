import { SearchXIcon, UserSearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { createSerializer } from "nuqs/server";

import { Button } from "@/components/actions/button";
import { DataTableEmpty } from "@/components/composites/data-table";
import { ListFooter } from "@/components/composites/list-footer";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PublicTalentList, PublicTalentSummary } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { TalentCard } from "./talent-card";
import { TalentFilters } from "./talent-filters";
import { talentSearch, type TalentSearch } from "./talent-search";
import { gridPageSizes, maxSearchPage } from "@/lib/page-size";

const address = createSerializer(talentSearch);

type TalentDirectoryPageProps = {
  talent: PublicTalentList;
  search: TalentSearch;
  /** True when the visitor is signed in and has a talent profile. */
  hasProfile: boolean;
  /** People to look at instead when the search and filters match nobody. */
  others: PublicTalentSummary[];
};

/**
 * AI talent: the public directory of the people GenAI Fund approved, on the template the directories
 * of use cases and solutions share. The list arrives already read; search, the role filter, the sort
 * and paging are the URL.
 */
function TalentDirectoryPage({ talent, search, hasProfile, others }: TalentDirectoryPageProps) {
  const t = useTranslations("Talent.directory");
  const filtered = search.q.trim() !== "" || search.role !== null;
  const shown = talent.items.length;

  return (
    <div className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-5 px-5 pt-8 pb-18 md:gap-7 md:px-8 md:pt-12 md:pb-22 xl:px-16 xl:pt-14 xl:pb-24 desktop:px-20">
      <header className="flex flex-col gap-2.5">
        <h1 className="text-3xl font-semibold tracking-title md:text-4xl xl:text-5xl xl:leading-none">
          {t("title")}
        </h1>
        <p className="max-w-180 text-base text-muted-foreground md:text-lg">{t("lead")}</p>
      </header>

      {talent.total === 0 && !filtered ? (
        <>
          <DataTableEmpty icon={<UserSearchIcon aria-hidden="true" />} title={t("empty.title")}>
            <Button prominence="secondary" size="sm" href={siteRoutes.talentProfile}>
              {t(hasProfile ? "edit" : "create")}
            </Button>
          </DataTableEmpty>
          <HowItWorks />
        </>
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
            <>
              <DataTableEmpty icon={<SearchXIcon aria-hidden="true" />} title={t("noMatch.title")}>
                <Button prominence="secondary" size="sm" href={siteRoutes.talent}>
                  {t("noMatch.clear")}
                </Button>
              </DataTableEmpty>
              {others.length > 0 && (
                <section aria-labelledby="talent-others" className="flex flex-col gap-4">
                  <h2 id="talent-others" className="text-lg font-semibold">
                    {t("others")}
                  </h2>
                  <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {others.map((person) => (
                      <li key={person.slug} className="flex min-w-0">
                        <TalentCard person={person} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
          {(search.size !== null || talent.total > Math.min(gridPageSizes[0], talent.pageSize)) && (
            <ListFooter
              count={t("total", { count: talent.total })}
              page={talent.page}
              pageSize={talent.pageSize}
              total={talent.total}
              href={(page) => address(siteRoutes.talent, { ...search, page })}
              sizes={gridPageSizes}
              maxPages={search.q.trim() ? maxSearchPage : undefined}
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

/** What happens from a profile to an enquiry, while the directory has nobody to show yet. */
function HowItWorks() {
  const t = useTranslations("Talent.directory.steps");
  const steps = ["create", "review", "reach"] as const;

  return (
    <section aria-labelledby="talent-steps" className="flex flex-col gap-4">
      <h2 id="talent-steps" className="text-lg font-semibold">
        {t("title")}
      </h2>
      <ol className="grid gap-4 md:grid-cols-3">
        {steps.map((step) => (
          <li key={step}>
            <Card size="lg" className="h-full">
              <CardHeader>
                <CardTitle>
                  <h3>{t(`${step}.title`)}</h3>
                </CardTitle>
                <CardDescription>{t(`${step}.body`)}</CardDescription>
              </CardHeader>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}

export { TalentDirectoryPage };
