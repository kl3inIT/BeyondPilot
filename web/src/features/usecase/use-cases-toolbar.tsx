"use client";

import { useTranslations } from "next-intl";
import { debounce, useQueryStates } from "nuqs";
import { useTransition } from "react";

import { DirectoryToolbar } from "@/components/composites/directory-toolbar";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVocabulary } from "@/i18n/vocabulary";

import { useCaseIndustries } from "./admin-use-case-codes";
import { useCaseSorts, useCasesSearch } from "./use-cases-search";

/** How long the search waits after the last keystroke before it asks the server. */
const SEARCH_DELAY_MS = 300;

function isIndustry(value: string): value is (typeof useCaseIndustries)[number] {
  return useCaseIndustries.some((industry) => industry === value);
}

type UseCasesToolbarProps = {
  /** How much of the list shows, already worded: "Showing 12 of 21". Absent when nothing matches. */
  count: string | null;
};

/**
 * Search, order and industry of the use case list. They are the URL: a change writes it and the
 * server renders the list again. Typing waits 300 ms before it asks, and any change returns to
 * page 1. Several industries may narrow the list at once; the field names one, or says how many.
 */
function UseCasesToolbar({ count }: UseCasesToolbarProps) {
  const t = useTranslations("UseCases");
  const industryName = useVocabulary("industry");
  const [loading, startTransition] = useTransition();
  const [search, setSearch] = useQueryStates(useCasesSearch, { shallow: false, startTransition });

  const industries = useCaseIndustries.map((value) => ({ value, label: industryName(value) }));
  const sorts = [
    ...(search.q.trim() ? [{ value: "relevance", label: t("sort.relevance") }] : []),
    ...useCaseSorts.map((sort) => ({ value: sort, label: t(`sort.${sort}`) })),
  ];

  return (
    <DirectoryToolbar
      search={{
        label: t("search"),
        value: search.q,
        loading,
        onChange: (q) =>
          setSearch(
            { q, page: null },
            { limitUrlUpdates: q ? debounce(SEARCH_DELAY_MS) : undefined },
          ),
      }}
      count={count}
      clear={
        search.industry.length > 0
          ? {
              label: t("industry.clear"),
              onClick: () => setSearch({ industry: null, page: null }),
            }
          : undefined
      }
    >
      <Select
        multiple
        items={industries}
        value={search.industry}
        onValueChange={(industry) =>
          setSearch({ industry: industry.filter(isIndustry), page: null })
        }
      >
        <SelectTrigger size="lg" aria-label={t("industry.label")} className="w-full md:w-60">
          <SelectValue>
            {(chosen: string[]) => {
              if (chosen.length === 0) {
                return t("industry.all");
              }
              return chosen.length === 1
                ? industryName(chosen[0])
                : t("industry.chosen", { count: chosen.length });
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {industries.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select
        items={sorts}
        value={search.sort ?? (search.q.trim() ? "relevance" : "newest")}
        onValueChange={(value) =>
          setSearch({
            sort: useCaseSorts.find((sort) => sort === value) ?? null,
            page: null,
          })
        }
      >
        <SelectTrigger size="lg" aria-label={t("sort.label")} className="w-full md:w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectGroup>
            {sorts.map((sort) => (
              <SelectItem key={sort.value} value={sort.value}>
                {sort.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </DirectoryToolbar>
  );
}

export { UseCasesToolbar };
