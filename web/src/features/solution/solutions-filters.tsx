"use client";

import { cn } from "cn";
import { SlidersHorizontalIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { debounce, useQueryStates } from "nuqs";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/actions/button";
import { DirectorySearch } from "@/components/composites/directory-search";
import { DirectorySortSelect } from "@/components/composites/directory-sort";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVocabulary } from "@/i18n/vocabulary";

import { focusAreas, industries, maturities } from "./solution-codes";
import { solutionsSearch } from "./solutions-search";

/** How long the search waits after the last keystroke before it asks the server. */
const SEARCH_DELAY_MS = 300;

/** The code among `codes` that a select answered, or none when it answered "all". */
function pick<Code extends string>(codes: readonly Code[], value: string | null): Code | null {
  return codes.find((code) => code === value) ?? null;
}

type FacetSelectProps = {
  label: string;
  /** The words of the select when the facet is off: "All industries". */
  all: string;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string | null) => void;
};

/** One facet of the directory. Off, it reads as a placeholder; the URL then has no such parameter. */
function FacetSelect({ label, all, options, value, onChange }: FacetSelectProps) {
  const items = [{ value: null, label: all }, ...options];

  return (
    <Select items={items} value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        className="h-11 w-full data-[size=default]:h-11 md:w-42 xl:shrink-0"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value ?? ""} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

type SolutionsFiltersProps = {
  /** How much of the list shows, already worded: "Showing 12 of 21". Absent when nothing matches. */
  count: string | null;
};

/**
 * The search, facets, count and order above the directory of solutions. They are the URL: a change
 * writes it and the server reads the list again, from page 1 (docs/conventions.md › Lists). On a
 * phone the facets fold behind one button; on a wide screen they share one toolbar row.
 */
function SolutionsFilters({ count }: SolutionsFiltersProps) {
  const t = useTranslations("Solution.filters");
  const industry = useVocabulary("industry");
  const focusArea = useVocabulary("focusArea");
  const maturity = useVocabulary("maturity");
  const [loading, startTransition] = useTransition();
  const [search, setSearch] = useQueryStates(solutionsSearch, {
    shallow: false,
    startTransition,
  });
  const narrowed =
    search.industry !== null || search.focusArea !== null || search.maturity !== null;
  const [open, setOpen] = useState(narrowed);
  const facets = useId();

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:gap-4">
      <DirectorySearch
        className="h-11 xl:max-w-none xl:min-w-56 xl:flex-1"
        label={t("search")}
        value={search.q}
        loading={loading}
        onChange={(q) =>
          setSearch(
            { q, page: null },
            { limitUrlUpdates: q ? debounce(SEARCH_DELAY_MS) : undefined },
          )
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between xl:shrink-0 xl:flex-nowrap xl:justify-end">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={facets}
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-input bg-background px-3.5 text-sm font-medium transition-colors outline-none hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden"
          onClick={() => setOpen(!open)}
        >
          <SlidersHorizontalIcon className="size-4" aria-hidden="true" />
          {t("toggle")}
        </button>
        <div
          id={facets}
          className={cn(
            open ? "flex" : "hidden",
            "flex-col gap-2 md:flex md:flex-row md:flex-wrap md:items-center xl:flex-nowrap",
          )}
        >
          <FacetSelect
            label={t("industry.label")}
            all={t("industry.all")}
            options={industries.map((value) => ({ value, label: industry(value) }))}
            value={search.industry}
            onChange={(value) => setSearch({ industry: pick(industries, value), page: null })}
          />
          <FacetSelect
            label={t("focusArea.label")}
            all={t("focusArea.all")}
            options={focusAreas.map((value) => ({ value, label: focusArea(value) }))}
            value={search.focusArea}
            onChange={(value) => setSearch({ focusArea: pick(focusAreas, value), page: null })}
          />
          <FacetSelect
            label={t("maturity.label")}
            all={t("maturity.all")}
            options={maturities.map((value) => ({ value, label: maturity(value) }))}
            value={search.maturity}
            onChange={(value) => setSearch({ maturity: pick(maturities, value), page: null })}
          />
          {narrowed && (
            <Button
              prominence="tertiary"
              size="sm"
              className="self-start md:self-auto"
              onClick={() =>
                setSearch({ industry: null, focusArea: null, maturity: null, page: null })
              }
            >
              <XIcon aria-hidden="true" />
              {t("clear")}
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 md:justify-end">
          {count && (
            <p className="flex h-11 items-center text-sm whitespace-nowrap text-muted-foreground">
              {count}
            </p>
          )}
          <DirectorySortSelect
            className="h-11 data-[size=default]:h-11"
            value={search.sort}
            onChange={(sort) => setSearch({ sort, page: null })}
          />
        </div>
      </div>
    </div>
  );
}

export { SolutionsFilters };
