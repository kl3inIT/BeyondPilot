"use client";

import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { useTransition } from "react";

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

/**
 * The phase tabs and the type filter of the programs list. They are the URL: a change writes it and
 * the server renders the list again.
 */
function ProgramsPublicFilters({
  counts,
}: {
  counts: Record<(typeof publicPhases)[number] | "all", number>;
}) {
  const t = useTranslations("Programs");
  const types = useTranslations("Program.type");
  const [, startTransition] = useTransition();
  const [search, setSearch] = useQueryStates(programsPublicSearch, {
    shallow: false,
    startTransition,
  });
  const typeItems = [
    { value: ALL, label: t("filters.allTypes") },
    ...programTypes.map((value) => ({ value, label: types(value) })),
  ];

  return (
    <div className="flex flex-col gap-3 border-b md:flex-row md:items-end md:justify-between">
      <Tabs
        value={search.phase ?? ALL}
        onValueChange={(value) =>
          setSearch({ phase: publicPhases.find((phase) => phase === value) ?? null })
        }
      >
        <TabsList variant="line" aria-label={t("filters.label")}>
          <TabsTrigger value={ALL}>{t("filters.all")}</TabsTrigger>
          {publicPhases.map((phase) => (
            <TabsTrigger key={phase} value={phase}>
              {t(`filters.${phase}`)}
              {counts[phase] > 0 && (
                <span className="text-muted-foreground tabular-nums">{counts[phase]}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="pb-3">
        <Select
          items={typeItems}
          value={search.type ?? ALL}
          onValueChange={(value) =>
            setSearch({ type: programTypes.find((type) => type === value) ?? null })
          }
        >
          <SelectTrigger size="sm" aria-label={t("filters.type")} className="w-full md:w-52">
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
      </div>
    </div>
  );
}

export { ProgramsPublicFilters };
