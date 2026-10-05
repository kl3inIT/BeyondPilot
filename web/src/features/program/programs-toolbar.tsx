"use client";

import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { debounce, useQueryStates } from "nuqs";
import { useTransition } from "react";

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { programStates, programsSearch } from "./programs-search";

/** The value of the tab that shows every program; the URL then has no `state`. */
const ALL = "all";

/**
 * The tabs and the search of the operators' list. They are the URL: a change writes it and the
 * server renders the list again. Each tab says how many programs are in its state.
 */
function ProgramsToolbar({
  counts,
  total,
}: {
  counts: Record<(typeof programStates)[number], number>;
  total: number;
}) {
  const t = useTranslations("Admin.programs");
  const [loading, startTransition] = useTransition();
  const [search, setSearch] = useQueryStates(programsSearch, { shallow: false, startTransition });

  return (
    <div className="flex flex-col gap-3">
      <Tabs
        value={search.state ?? ALL}
        onValueChange={(value) =>
          setSearch({ state: programStates.find((state) => state === value) ?? null })
        }
      >
        <div className="overflow-x-auto">
          <TabsList variant="line" aria-label={t("filters.label")}>
            <TabsTrigger value={ALL}>
              {t("filters.all")}
              <span className="text-muted-foreground tabular-nums">{total}</span>
            </TabsTrigger>
            {programStates.map((state) => (
              <TabsTrigger key={state} value={state}>
                {t(`filters.${state}`)}
                <span className="text-muted-foreground tabular-nums">{counts[state]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
      <InputGroup className="md:max-w-sm">
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
              { q: event.target.value },
              { limitUrlUpdates: event.target.value ? debounce(300) : undefined },
            )
          }
        />
      </InputGroup>
    </div>
  );
}

export { ProgramsToolbar };
