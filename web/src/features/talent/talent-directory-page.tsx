import { SearchXIcon, UserSearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { createSerializer } from "nuqs/server";

import { Button } from "@/components/actions/button";
import { ListFooter } from "@/components/composites/list-footer";
import { Section } from "@/components/ui/section";
import type { PublicTalentList } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { TalentCard } from "./talent-card";
import { TalentFilterBar, TalentFilterSidebar } from "./talent-filters";
import { talentSearch, type TalentSearch } from "./talent-search";
import { TalentSearchField } from "./talent-search-field";
import { TalentSort } from "./talent-sort";

const address = createSerializer(talentSearch);

type TalentDirectoryPageProps = {
  talent: PublicTalentList;
  search: TalentSearch;
  /** True when the visitor is signed in and has a talent profile. */
  hasProfile: boolean;
};

/**
 * AI talent: the public directory of the people GenAI Fund approved. The list arrives already read;
 * search, the facets and paging are the URL.
 */
function TalentDirectoryPage({ talent, search, hasProfile }: TalentDirectoryPageProps) {
  const t = useTranslations("Talent.directory");
  const filtered = search.q.trim() !== "" || search.role !== null || search.availability !== null;
  const profileAction = (
    <Button prominence="secondary" href={siteRoutes.talentProfile}>
      {t(hasProfile ? "edit" : "create")}
    </Button>
  );

  return (
    <Section surface="muted" className="flex-1">
      <div className="flex flex-col gap-5 pt-8 pb-18 md:gap-7 md:pt-12 md:pb-22 xl:pt-14 xl:pb-24">
        <div className="flex flex-col gap-2.5">
          <h1 className="text-3xl font-semibold tracking-title md:text-4xl md:tracking-normal xl:text-5xl xl:leading-none xl:tracking-title">
            {t("title")}
          </h1>
          <p className="max-w-180 text-muted-foreground md:text-lg">{t("lead")}</p>
        </div>
        <TalentSearchField />

        {talent.total === 0 && !filtered ? (
          <DirectoryEmpty
            icon={<UserSearchIcon aria-hidden="true" />}
            title={t("empty.title")}
            description={t("empty.description")}
          >
            {profileAction}
          </DirectoryEmpty>
        ) : (
          <>
            <div className="flex gap-8">
              <TalentFilterSidebar />
              <div className="flex min-w-0 flex-1 flex-col gap-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <TalentFilterBar />
                  <div className="flex flex-1 items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      {talent.items.length > 0 &&
                        t("count", { shown: talent.items.length, total: talent.total })}
                    </p>
                    <TalentSort />
                  </div>
                </div>
                {talent.items.length > 0 ? (
                  <ul className="grid gap-4 lg:grid-cols-2">
                    {talent.items.map((person) => (
                      <li key={person.slug} className="flex min-w-0">
                        <TalentCard person={person} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <DirectoryEmpty
                    icon={<SearchXIcon aria-hidden="true" />}
                    title={t("noMatch.title")}
                    description={t("noMatch.description")}
                  >
                    <Button prominence="secondary" href={siteRoutes.talent}>
                      {t("noMatch.clear")}
                    </Button>
                  </DirectoryEmpty>
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
              </div>
            </div>
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
              <Button prominence="secondary" size="lg" href={siteRoutes.talentProfile}>
                {t(hasProfile ? "edit" : "create")}
              </Button>
            </section>
          </>
        )}
      </div>
    </Section>
  );
}

type DirectoryEmptyProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  /** The one action that leads out of this state. */
  children: React.ReactNode;
};

/**
 * What the directory shows in place of its cards, as the Figma frame draws it: a dashed card that
 * reads from the left. A list with nothing in it yet and a search that found nothing are different
 * states with their own words.
 */
function DirectoryEmpty({ icon, title, description, children }: DirectoryEmptyProps) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed bg-card p-8 [&>svg]:size-5">
      {icon}
      <div className="flex flex-col gap-1">
        <h2 className="font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

export { TalentDirectoryPage };
