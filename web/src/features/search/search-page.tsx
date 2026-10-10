import {
  ArrowRightIcon,
  SearchIcon,
  SearchXIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { createSerializer } from "nuqs/server";

import { Button } from "@/components/actions/button";
import { ListFooter } from "@/components/composites/list-footer";
import { Badge } from "@/components/ui/badge";
import { getPathname, Link } from "@/i18n/navigation";
import type { SearchItem, SearchResults } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";
import { cn } from "@/lib/utils";

import { searchKinds, searchParams, type SearchKind, type SearchParams } from "./search-params";
import { MAX_QUERY } from "./search-queries";
import { SearchResult } from "./search-result";

const address = createSerializer(searchParams);

/** The queries offered when nothing matched, or nothing was asked yet: the landing's popular searches. */
const popular = ["agentic", "document", "insurance", "retail"] as const;

/** Where each kind is browsed and narrowed further; programs are narrowed by type and phase, not by text. */
const directories: Record<SearchKind, string> = {
  use_case: siteRoutes.useCases,
  program: siteRoutes.programs,
  solution: siteRoutes.solutions,
  talent: siteRoutes.talent,
};

type SearchPageProps = {
  params: SearchParams;
  results: SearchResults | null;
};

/**
 * Search over programs, AI solutions and AI talent. The All tab shows the best few of each kind,
 * the kinds in the order of their best result; a kind's tab pages through it and leads on to its
 * directory, which narrows further. The query is the URL, so a result page can be shared.
 */
function SearchPage({ params, results }: SearchPageProps) {
  const t = useTranslations("Search");
  const q = params.q.trim().slice(0, MAX_QUERY);
  const kind = params.kind;

  return (
    <div className="mx-auto flex w-full max-w-360 flex-1 flex-col px-5 pt-6 pb-18 md:px-8 md:pt-10 md:pb-22 xl:px-16 desktop:px-20">
      <div className="flex w-full max-w-220 flex-col gap-6">
        <div className="flex flex-col gap-3">
          <SearchField q={q} />
          {results && results.counts.all > 0 && (
            <h1 className="text-sm text-muted-foreground">
              {t.rich(kind ? `kindResults.${kind}` : "results", {
                count: kind ? results.total : results.counts.all,
                q,
                query: (chunks) => (
                  <strong className="font-semibold text-foreground">{chunks}</strong>
                ),
              })}
            </h1>
          )}
        </div>

        {!results ? (
          <Prompt title={t("start.title")} />
        ) : results.counts.all === 0 ? (
          <Prompt
            title={t("none.title", { q })}
            description={t("none.description")}
            icon={<SearchXIcon aria-hidden="true" className="size-6 text-muted-foreground" />}
          />
        ) : (
          <>
            <KindTabs q={q} kind={kind} counts={results.counts} />
            {kind ? (
              <KindResults q={q} kind={kind} results={results} />
            ) : (
              <AllResults q={q} items={results.items} counts={results.counts} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** How many of a kind matched; the counts name use cases in camel case, as the API writes them. */
function countOf(counts: SearchResults["counts"], kind: SearchKind) {
  return kind === "use_case" ? counts.useCase : counts[kind];
}

/** The query, which a person corrects here; a new query starts again on the All tab. */
function SearchField({ q }: { q: string }) {
  const t = useTranslations("Search");
  const locale = useLocale();
  return (
    <form
      role="search"
      action={getPathname({ href: siteRoutes.search, locale })}
      className="flex w-full items-center gap-2 rounded-full border bg-card py-1.5 pr-1.5 pl-5 shadow-search focus-within:ring-3 focus-within:ring-ring/50 md:gap-3"
    >
      <SearchIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <label htmlFor="search-query" className="sr-only">
        {t("label")}
      </label>
      <input
        id="search-query"
        name="q"
        type="search"
        defaultValue={q}
        maxLength={MAX_QUERY}
        placeholder={t("placeholder")}
        className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
      />
      {q && (
        <Link
          href={siteRoutes.search}
          aria-label={t("clear")}
          className="hit-area flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <XIcon className="size-4" aria-hidden="true" />
        </Link>
      )}
      <Button type="submit" size="lg">
        {t("submit")}
      </Button>
    </form>
  );
}

/** All, then each kind with how many it found; a kind that found nothing has no tab. */
function KindTabs({
  q,
  kind,
  counts,
}: {
  q: string;
  kind: SearchKind | null;
  counts: SearchResults["counts"];
}) {
  const t = useTranslations("Search.kinds");
  const tabs = [
    { key: "all" as const, count: counts.all, href: address(siteRoutes.search, { q }) },
    ...searchKinds
      .filter((each) => countOf(counts, each) > 0 || each === kind)
      .map((each) => ({
        key: each,
        count: countOf(counts, each),
        href: address(siteRoutes.search, { q, kind: each }),
      })),
  ];
  const current = kind ?? "all";

  return (
    <nav aria-label={t("label")} className="-mx-5 overflow-x-auto border-b px-5 md:mx-0 md:px-0">
      <ul className="flex gap-6 md:gap-7">
        {tabs.map((tab) => (
          <li key={tab.key} className="shrink-0">
            <Link
              href={tab.href}
              aria-current={tab.key === current ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 border-b-2 text-sm outline-none focus-visible:underline",
                tab.key === current
                  ? "border-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t(tab.key)}{" "}
              <span className={cn("text-xs", tab.key === current && "text-primary")}>
                {tab.count}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The best few of each kind, grouped, the groups in the order the results came. */
function AllResults({
  q,
  items,
  counts,
}: {
  q: string;
  items: SearchItem[];
  counts: SearchResults["counts"];
}) {
  const t = useTranslations("Search");
  const groups = new Map<SearchKind, SearchItem[]>();
  for (const item of items) {
    groups.set(item.kind, [...(groups.get(item.kind) ?? []), item]);
  }

  return (
    <div className="flex flex-col gap-8">
      {[...groups].map(([kind, group]) => (
        <section key={kind} aria-labelledby={`results-${kind}`} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <h2 id={`results-${kind}`} className="text-lg font-semibold">
              {t(`kinds.${kind}`)}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {countOf(counts, kind)}
              </span>
            </h2>
            {countOf(counts, kind) > group.length && (
              <Link
                href={address(siteRoutes.search, { q, kind })}
                className="hit-area inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {t("seeAll", { count: countOf(counts, kind) })}
                <ArrowRightIcon className="size-4" aria-hidden="true" />
              </Link>
            )}
          </div>
          <ResultList items={group} />
        </section>
      ))}
    </div>
  );
}

/** One kind's results a page at a time, then the way on to its directory. */
function KindResults({
  q,
  kind,
  results,
}: {
  q: string;
  kind: SearchKind;
  results: SearchResults;
}) {
  const t = useTranslations("Search");
  const directory =
    kind === "program" ? directories[kind] : `${directories[kind]}?q=${encodeURIComponent(q)}`;

  return (
    <div className="flex flex-col gap-5">
      {results.items.length > 0 ? (
        <ResultList items={results.items} />
      ) : (
        <p className="text-sm text-muted-foreground">{t("pastTheEnd")}</p>
      )}
      {results.total > results.pageSize && (
        <ListFooter
          count={t("count", { count: results.total })}
          page={results.page}
          pageSize={results.pageSize}
          total={results.total}
          href={(page) => address(siteRoutes.search, { q, kind, page })}
        />
      )}
      <Link
        href={directory}
        className="inline-flex items-center gap-2 self-start rounded-sm text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <SlidersHorizontalIcon className="size-4 shrink-0" aria-hidden="true" />
        {t(`directory.${kind}`)}
        <ArrowRightIcon className="size-4 shrink-0" aria-hidden="true" />
      </Link>
    </div>
  );
}

function ResultList({ items }: { items: SearchItem[] }) {
  return (
    <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
      {items.map((item) => (
        <li key={`${item.kind}-${item.slug}`}>
          <SearchResult item={item} />
        </li>
      ))}
    </ul>
  );
}

/** Before a query, and when nothing matched: queries to try and the directories to browse. */
function Prompt({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  const t = useTranslations("Search");
  const scopes = useTranslations("Home.hero.scopes");

  return (
    <section className="flex flex-col gap-5 rounded-2xl border bg-card p-6 md:p-10">
      <div className="flex flex-col gap-1.5">
        {icon}
        <h1 className="text-lg font-semibold">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex flex-col gap-2.5">
        <h2 className="text-xs font-medium text-muted-foreground">{t("try")}</h2>
        <ul className="flex flex-wrap gap-2">
          {popular.map((scope) => (
            <li key={scope} className="flex">
              <Badge
                variant="outline"
                render={<Link href={address(siteRoutes.search, { q: scopes(scope) })} />}
                className="hit-area"
              >
                {scopes(scope)}
              </Badge>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-2.5 border-t pt-4">
        <h2 className="text-xs font-medium text-muted-foreground">{t("browse")}</h2>
        <ul className="flex flex-col gap-2.5 md:flex-row md:gap-6">
          {searchKinds.map((each) => (
            <li key={each}>
              <Link
                href={directories[each]}
                className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {t(`kinds.${each}`)}
                <ArrowRightIcon className="size-4" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export { SearchPage };
