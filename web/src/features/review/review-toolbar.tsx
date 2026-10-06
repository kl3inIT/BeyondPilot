"use client";

import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { useTransition } from "react";

import { FilterToolbar } from "@/components/composites/filter-toolbar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVocabulary } from "@/i18n/vocabulary";

import { applicantKinds, judgeTabs, operatorTabs, reviewSearch } from "./review-search";

type ReviewToolbarProps = {
  operator: boolean;
  counts: Record<string, number>;
  /** The program's first one-choice question, which the list filters by. */
  choice: { label: string; options: string[] } | null;
};

/**
 * The tabs, the search and the filters above a program's applications. They are the URL: a change
 * writes it and the server renders the list again. Each tab says how many it holds.
 */
function ReviewToolbar({ operator, counts, choice }: ReviewToolbarProps) {
  const t = useTranslations("Review.list");
  const type = useVocabulary("organizationType");
  const [, startTransition] = useTransition();
  const [search, setSearch] = useQueryStates(reviewSearch, { shallow: false, startTransition });
  const tabs = operator ? operatorTabs : judgeTabs;

  return (
    <div className="flex flex-col gap-3">
      <Tabs
        value={search.tab}
        onValueChange={(value) => setSearch({ tab: tabs.find((tab) => tab === value) ?? null })}
      >
        <div className="overflow-x-auto">
          <TabsList variant="line" aria-label={t("tabs.label")}>
            {tabs.map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {t(`tabs.${tab}`)}
                <span className="text-muted-foreground tabular-nums">{counts[tab] ?? 0}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
      <FilterToolbar
        parsers={reviewSearch}
        searchLabel={t("search")}
        clearLabel={t("clear")}
        filters={[
          ...(choice
            ? [
                {
                  key: "choice",
                  label: choice.label,
                  all: t("allChoices", { label: choice.label }),
                  options: choice.options.map((option) => ({ value: option, label: option })),
                },
              ]
            : []),
          {
            key: "kind",
            label: t("kind"),
            all: t("allKinds"),
            options: applicantKinds.map((kind) => ({ value: kind, label: type(kind) })),
          },
        ]}
      />
    </div>
  );
}

export { ReviewToolbar };
