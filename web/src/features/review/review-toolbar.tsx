"use client";

import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { useTransition } from "react";

import { useRouter } from "@/i18n/navigation";

import { FilterToolbar } from "@/components/composites/filter-toolbar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVocabulary } from "@/i18n/vocabulary";

import { applicantKinds, judgeTabs, operatorTabs, reviewSearch } from "./review-search";

/** The drafts not submitted yet, a tab of their own that opens their page; operators only. */
type DraftsTab = { count: number; href: string };

type ReviewTabsProps = {
  operator: boolean;
  counts: Record<string, number>;
  drafts?: DraftsTab;
  /** The tab shown: one of the list's, or `drafts` on the drafts' page. */
  current: string;
  /** The applications' address, where a tab of the list leads from the drafts' page. */
  base: string;
  onSelect?: (tab: string) => void;
};

/**
 * The row of tabs over a program's applications, each with how many it holds. The list's tabs
 * narrow the list; Drafts opens the drafts not submitted, whose columns are their own, and from
 * there a list tab leads back to the list narrowed by it.
 */
function ReviewTabs({ operator, counts, drafts, current, base, onSelect }: ReviewTabsProps) {
  const t = useTranslations("Review.list");
  const router = useRouter();
  const tabs = operator ? operatorTabs : judgeTabs;

  return (
    <Tabs
      value={current}
      onValueChange={(value) => {
        if (value === "drafts" && drafts) {
          router.push(drafts.href);
        } else if (current === "drafts") {
          router.push(value === "all" ? base : `${base}?tab=${value}`);
        } else {
          onSelect?.(String(value));
        }
      }}
    >
      {/* Wider than a narrow screen: the row scrolls, and its edge fades where more tabs wait. */}
      <div className="scroll-fade-x scrollbar-none overflow-x-auto">
        <TabsList variant="line" aria-label={t("tabs.label")}>
          {tabs.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {t(`tabs.${tab}`)}
              <span className="text-muted-foreground tabular-nums">{counts[tab] ?? 0}</span>
            </TabsTrigger>
          ))}
          {drafts && (
            <TabsTrigger value="drafts">
              {t("tabs.drafts")}
              <span className="text-muted-foreground tabular-nums">{drafts.count}</span>
            </TabsTrigger>
          )}
        </TabsList>
      </div>
    </Tabs>
  );
}

type ReviewToolbarProps = {
  operator: boolean;
  counts: Record<string, number>;
  drafts?: DraftsTab;
  base: string;
  /** The program's first one-choice question, which the list filters by. */
  choice: { label: string; options: string[] } | null;
};

/**
 * The tabs, the search and the filters above a program's applications. They are the URL: a change
 * writes it and the server renders the list again. Each tab says how many it holds.
 */
function ReviewToolbar({ operator, counts, drafts, base, choice }: ReviewToolbarProps) {
  const t = useTranslations("Review.list");
  const type = useVocabulary("organizationType");
  const [, startTransition] = useTransition();
  const [search, setSearch] = useQueryStates(reviewSearch, { shallow: false, startTransition });
  const tabs = operator ? operatorTabs : judgeTabs;

  return (
    <div className="flex flex-col gap-3">
      <ReviewTabs
        operator={operator}
        counts={counts}
        drafts={drafts}
        current={search.tab}
        base={base}
        onSelect={(value) =>
          setSearch({ tab: tabs.find((tab) => tab === value) ?? null, page: null })
        }
      />
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

export { ReviewTabs, ReviewToolbar };
