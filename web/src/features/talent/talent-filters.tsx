"use client";

import { useTranslations } from "next-intl";
import { debounce, useQueryStates } from "nuqs";
import { useTransition } from "react";

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

import { talentRoles } from "./talent-codes";
import { talentSearch } from "./talent-search";

/** How long the search waits after the last keystroke before it asks the server. */
const SEARCH_DELAY_MS = 300;

type TalentFiltersProps = {
  /** How much of the list shows, already worded: "Showing 12 of 21". Absent when nothing matches. */
  count: string | null;
};

/** Directory filters write URL state and return to the first page. */
function TalentFilters({ count }: TalentFiltersProps) {
  const t = useTranslations("Talent.filters");
  const role = useVocabulary("talentRole");
  const [loading, startTransition] = useTransition();
  const [search, setSearch] = useQueryStates(talentSearch, { shallow: false, startTransition });
  const roles = [
    { value: null, label: t("role.all") },
    ...talentRoles.map((value) => ({ value, label: role(value) })),
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
        search.role === null
          ? undefined
          : { label: t("clear"), onClick: () => setSearch({ role: null, page: null }) }
      }
    >
      <Select
        items={roles}
        value={search.role}
        onValueChange={(value) =>
          setSearch({ role: talentRoles.find((role) => role === value) ?? null, page: null })
        }
      >
        <SelectTrigger size="lg" aria-label={t("role.label")} className="w-full md:w-60">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {roles.map((item) => (
              <SelectItem key={item.value ?? "all"} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <DirectorySortSelect
        searching={Boolean(search.q.trim())}
        value={search.sort}
        onChange={(sort) => setSearch({ sort, page: null })}
      />
    </DirectoryToolbar>
  );
}

export { TalentFilters };
