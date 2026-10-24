"use client";

import { cn } from "cn";
import { SlidersHorizontalIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { debounce, useQueryStates } from "nuqs";
import { useId, useState, useTransition } from "react";

import { DirectorySortSelect } from "@/components/composites/directory-sort";
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

import { focusAreas, industries, maturities } from "./solution-codes";
import { perkChoices, solutionsSearch } from "./solutions-search";

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
      <SelectTrigger aria-label={label} size="lg" className="w-full md:w-40 xl:w-44">
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
    search.industry !== null ||
    search.focusArea !== null ||
    search.maturity !== null ||
    search.perks !== null;
  const [open, setOpen] = useState(narrowed);
  const facets = useId();

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
        narrowed
          ? {
              label: t("clear"),
              onClick: () =>
                setSearch({
                  industry: null,
                  focusArea: null,
                  maturity: null,
                  perks: null,
                  page: null,
                }),
            }
          : undefined
      }
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={facets}
        className="flex h-12 items-center justify-center gap-2 rounded-lg border border-input bg-background px-3.5 text-sm font-medium transition-colors outline-none hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden"
        onClick={() => setOpen(!open)}
      >
        <SlidersHorizontalIcon className="size-4" aria-hidden="true" />
        {t("toggle")}
      </button>
      <div
        id={facets}
        className={cn(
          open ? "flex" : "hidden",
          "flex-col gap-3 md:flex md:flex-row md:items-center",
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
        <FacetSelect
          label={t("perks.label")}
          all={t("perks.all")}
          options={[{ value: "active", label: t("perks.active") }]}
          value={search.perks}
          onChange={(value) => setSearch({ perks: pick(perkChoices, value), page: null })}
        />
      </div>
      <DirectorySortSelect
        searching={Boolean(search.q.trim())}
        value={search.sort}
        onChange={(sort) => setSearch({ sort, page: null })}
      />
    </DirectoryToolbar>
  );
}

export { SolutionsFilters };
