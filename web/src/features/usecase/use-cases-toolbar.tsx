"use client";

import { cva } from "class-variance-authority";
import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { debounce, useQueryStates } from "nuqs";
import { useTransition } from "react";

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

import { useVocabulary } from "@/i18n/vocabulary";
import { useCaseIndustries } from "./admin-use-case-codes";
import { useCaseSorts, useCasesSearch } from "./use-cases-search";

/** An industry chip: the chosen one is ink on the page, the others sit quietly on Paper. */
const chip = cva(
  "hit-area inline-flex h-9 shrink-0 items-center rounded-lg border px-4 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
  {
    variants: {
      chosen: {
        true: "border-foreground bg-foreground text-background",
        false:
          "border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      },
    },
  },
);

/**
 * Search, order and industry of the use case list. They are the URL: a change writes it and the
 * server renders the list again. Typing waits 300 ms before it asks, and any change returns to
 * page 1.
 */
function UseCasesToolbar() {
  const t = useTranslations("UseCases");
  const industryName = useVocabulary("industry");
  const [loading, startTransition] = useTransition();
  const [search, setSearch] = useQueryStates(useCasesSearch, { shallow: false, startTransition });

  const sorts = useCaseSorts.map((sort) => ({ value: sort, label: t(`sort.${sort}`) }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <InputGroup className="md:flex-1">
          <InputGroupAddon>
            {loading ? <Spinner /> : <SearchIcon aria-hidden="true" />}
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label={t("search")}
            placeholder={t("search")}
            value={search.q}
            maxLength={100}
            onChange={(event) =>
              setSearch(
                { q: event.target.value, page: null },
                { limitUrlUpdates: event.target.value ? debounce(300) : undefined },
              )
            }
          />
        </InputGroup>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground" aria-hidden="true">
            {t("sort.label")}
          </span>
          <Select
            items={sorts}
            value={search.sort}
            onValueChange={(value) =>
              setSearch({
                sort: useCaseSorts.find((sort) => sort === value) ?? null,
                page: null,
              })
            }
          >
            <SelectTrigger size="sm" aria-label={t("sort.label")} className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {sorts.map((sort) => (
                  <SelectItem key={sort.value} value={sort.value}>
                    {sort.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* On a phone the chips run past the edge and scroll sideways, as one line. */}
      <div
        role="group"
        aria-label={t("industry.label")}
        className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0"
      >
        <button
          type="button"
          aria-pressed={search.industry === null}
          className={chip({ chosen: search.industry === null })}
          onClick={() => setSearch({ industry: null, page: null })}
        >
          {t("industry.all")}
        </button>
        {useCaseIndustries.map((industry) => (
          <button
            key={industry}
            type="button"
            aria-pressed={search.industry === industry}
            className={chip({ chosen: search.industry === industry })}
            onClick={() => setSearch({ industry, page: null })}
          >
            {industryName(industry)}
          </button>
        ))}
      </div>
    </div>
  );
}

export { UseCasesToolbar };
