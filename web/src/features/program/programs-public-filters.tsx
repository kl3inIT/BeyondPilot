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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { programTypes } from "./program-schemas";
import { programsPublicSearch, publicPhases } from "./programs-public-search";

/** The value of the tab and the select that narrow nothing; the URL then has no parameter. */
const ALL = "all";

/** How long the search waits after the last keystroke before it asks the server. */
const SEARCH_DELAY_MS = 300;

/**
 * The search, the type filter and the phase tabs of the programs list. They are the URL: a change
 * writes it and the server renders the list again. Only a search has an order to choose; without one
 * the order stays in its place, switched off, so nothing moves when a person starts typing.
 */
function ProgramsPublicFilters({
  counts,
}: {
  counts: Record<(typeof publicPhases)[number] | "all", number>;
}) {
  const t = useTranslations("Programs");
  const types = useTranslations("Program.type");
  const [loading, startTransition] = useTransition();
  const [search, setSearch] = useQueryStates(programsPublicSearch, {
    shallow: false,
    startTransition,
  });
  const searching = Boolean(search.q.trim());
  const typeItems = [
    { value: ALL, label: t("filters.allTypes") },
    ...programTypes.map((value) => ({ value, label: types(value) })),
  ];

  return (
    <div className="flex flex-col gap-3 border-b">
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
      >
        <Select
          items={typeItems}
          value={search.type ?? ALL}
          onValueChange={(value) =>
            setSearch({ type: programTypes.find((type) => type === value) ?? null, page: null })
          }
        >
          <SelectTrigger size="lg" aria-label={t("filters.type")} className="w-full md:w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {typeItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <DirectorySortSelect
          searching={searching}
          disabled={!searching}
          value={searching && search.sort !== "relevance" ? search.sort : null}
          onChange={(sort) => setSearch({ sort, page: null })}
        />
      </DirectoryToolbar>
      <Tabs
        value={search.phase ?? ALL}
        onValueChange={(value) =>
          setSearch({ phase: publicPhases.find((phase) => phase === value) ?? null, page: null })
        }
      >
        <TabsList variant="underline" aria-label={t("filters.label")}>
          <TabsTrigger value={ALL}>{t("filters.all")}</TabsTrigger>
          {publicPhases.map((phase) => (
            <TabsTrigger key={phase} value={phase}>
              {t(`filters.${phase}`)}
              {!searching && counts[phase] > 0 && (
                <span className="text-muted-foreground tabular-nums">{counts[phase]}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}

export { ProgramsPublicFilters };
