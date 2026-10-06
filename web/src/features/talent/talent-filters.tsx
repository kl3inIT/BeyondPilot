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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { countryCodes, useCountryName, useVocabulary } from "@/i18n/vocabulary";

import { availabilities, engagements, talentRoles } from "./talent-codes";
import { talentSearch } from "./talent-search";

/** How long the search waits after the last keystroke before it asks the server. */
const SEARCH_DELAY_MS = 300;

/** The roles the chips offer; the others are reached by search. */
const chipRoles = [
  "forward_deployed_engineer",
  "ai_engineer",
  "ml_engineer",
  "automation_specialist",
  "data_engineer",
  "data_scientist",
] as const;

/** The value of the chip that lifts the role filter. */
const ALL = "all";

/** The code among `codes` that a control answered, or none when it answered "all". */
function pick<Code extends string>(codes: readonly Code[], value: string | null): Code | null {
  return codes.find((code) => code === value) ?? null;
}

type FacetSelectProps = {
  label: string;
  /** The words of the select when the facet is off: "Any availability". */
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
      <SelectTrigger aria-label={label} className="w-full md:w-47.5">
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

type TalentFiltersProps = {
  /** How much of the list shows, already worded: "Showing 12 of 21". Absent when nothing matches. */
  count: string | null;
};

/**
 * The search, the role chips and the facets above the directory of talent, as the directories of
 * use cases and solutions have them. They are the URL: a change writes it and the server reads the
 * list again, from page 1 (docs/conventions.md › Lists). On a phone the chips scroll sideways and
 * the facets fold behind one button.
 */
function TalentFilters({ count }: TalentFiltersProps) {
  const t = useTranslations("Talent.filters");
  const role = useVocabulary("talentRole");
  const availability = useVocabulary("availability");
  const engagement = useVocabulary("engagement");
  const countryName = useCountryName();
  const [loading, startTransition] = useTransition();
  const [search, setSearch] = useQueryStates(talentSearch, { shallow: false, startTransition });
  const narrowed =
    search.availability !== null || search.engagement !== null || search.country !== null;
  const [open, setOpen] = useState(narrowed);
  const facets = useId();
  // A role the chips do not offer, chosen by an address, still shows as chosen.
  const roles = [
    ...chipRoles,
    ...(search.role && !pick(chipRoles, search.role) ? [search.role] : []),
  ];

  return (
    <>
      <DirectorySearch
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

      {/* On a phone the chips scroll sideways, edge to edge. */}
      <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:overflow-visible md:px-0">
        <ToggleGroup
          aria-label={t("role.label")}
          variant="outline"
          size="sm"
          className="w-max md:w-full md:flex-wrap"
          value={[search.role ?? ALL]}
          onValueChange={(value) => {
            const chosen = value[0] ?? ALL;
            setSearch({ role: pick(talentRoles, chosen), page: null });
          }}
        >
          <ToggleGroupItem value={ALL} className="shrink-0">
            {t("role.all")}
          </ToggleGroupItem>
          {roles.map((value) => (
            <ToggleGroupItem key={value} value={value} className="shrink-0">
              {role(value)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={facets}
          className="flex h-10 items-center justify-center gap-2 rounded-lg border border-input bg-background px-3.5 text-sm font-medium transition-colors outline-none hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden"
          onClick={() => setOpen(!open)}
        >
          <SlidersHorizontalIcon className="size-4" aria-hidden="true" />
          {t("open")}
        </button>
        <div
          id={facets}
          className={cn(
            open ? "flex" : "hidden",
            "flex-col gap-2 md:flex md:flex-row md:flex-wrap md:items-center",
          )}
        >
          <FacetSelect
            label={t("availability.label")}
            all={t("availability.all")}
            options={availabilities.map((value) => ({ value, label: availability(value) }))}
            value={search.availability}
            onChange={(value) =>
              setSearch({ availability: pick(availabilities, value), page: null })
            }
          />
          <FacetSelect
            label={t("engagement.label")}
            all={t("engagement.all")}
            options={engagements.map((value) => ({ value, label: engagement(value) }))}
            value={search.engagement}
            onChange={(value) => setSearch({ engagement: pick(engagements, value), page: null })}
          />
          <FacetSelect
            label={t("country.label")}
            all={t("country.all")}
            options={countryCodes.map((value) => ({ value, label: countryName(value) }))}
            value={search.country}
            onChange={(value) => setSearch({ country: pick(countryCodes, value), page: null })}
          />
          {narrowed && (
            <Button
              prominence="tertiary"
              size="sm"
              className="self-start md:self-auto"
              onClick={() =>
                setSearch({ availability: null, engagement: null, country: null, page: null })
              }
            >
              <XIcon aria-hidden="true" />
              {t("clear")}
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 md:justify-end">
          {count && <p className="text-sm text-muted-foreground">{count}</p>}
          <DirectorySortSelect
            value={search.sort}
            onChange={(sort) => setSearch({ sort, page: null })}
          />
        </div>
      </div>
    </>
  );
}

export { TalentFilters };
