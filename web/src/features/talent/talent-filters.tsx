"use client";

import { useTranslations } from "next-intl";
import { debounce, useQueryStates } from "nuqs";
import { useTransition } from "react";

import { DirectorySearch } from "@/components/composites/directory-search";
import { DirectorySortSelect } from "@/components/composites/directory-sort";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useVocabulary } from "@/i18n/vocabulary";

import { talentRoles } from "./talent-codes";
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

type TalentFiltersProps = {
  /** How much of the list shows, already worded: "Showing 12 of 21". Absent when nothing matches. */
  count: string | null;
};

/**
 * The search with the count and the sort beside it, then the role chips, above the directory of
 * talent. They are the URL: a change writes it and the server reads the list again, from page 1
 * (docs/conventions.md › Lists). On a phone the chips scroll sideways.
 */
function TalentFilters({ count }: TalentFiltersProps) {
  const t = useTranslations("Talent.filters");
  const role = useVocabulary("talentRole");
  const [loading, startTransition] = useTransition();
  const [search, setSearch] = useQueryStates(talentSearch, { shallow: false, startTransition });
  // A role the chips do not offer, chosen by an address, still shows as chosen.
  const roles = [
    ...chipRoles,
    ...(search.role && !pick(chipRoles, search.role) ? [search.role] : []),
  ];

  return (
    <>
      {/* The count and the sort share the search's row; on a phone they sit under it. */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
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
        <div className="flex shrink-0 items-center justify-between gap-3 md:justify-end">
          {count && <p className="text-sm text-muted-foreground">{count}</p>}
          <DirectorySortSelect
            value={search.sort}
            onChange={(sort) => setSearch({ sort, page: null })}
          />
        </div>
      </div>

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
    </>
  );
}

export { TalentFilters };
