"use client";

import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { useTransition } from "react";

import { ExportMenu } from "@/components/composites/export-menu";
import { FilterToolbar } from "@/components/composites/filter-toolbar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { exportProgramScores } from "@/lib/api/generated";

import { scoresSearch, scoresViews } from "./scores-search";

/**
 * The switch between By application and By judge, and the search above the Scores tab. They are
 * the URL: a change writes it and the server renders the tab again.
 */
function ScoresToolbar() {
  const t = useTranslations("Review.scores");
  const list = useTranslations("Review.list");
  const [, startTransition] = useTransition();
  const [search, setSearch] = useQueryStates(scoresSearch, { shallow: false, startTransition });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          aria-label={t("view.label")}
          value={[search.view]}
          onValueChange={(values) => {
            const next = scoresViews.find((view) => view === values.at(-1));
            if (next) {
              // Each view sorts by its own columns.
              setSearch({ view: next === "applications" ? null : next, sort: null });
            }
          }}
        >
          {scoresViews.map((view) => (
            <ToggleGroupItem key={view} value={view}>
              {t(`view.${view}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="md:flex-1">
          <FilterToolbar
            parsers={scoresSearch}
            resets={[]}
            searchLabel={t("search")}
            clearLabel={list("clear")}
            filters={[]}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Downloads every scorer's scores of the applications the tab shows, one line for each scorer and
 * application with each criterion's score. The backend records each download.
 */
function ExportScores({
  programId,
  applicationIds,
  disabled,
}: {
  programId: string;
  /** The applications the tab shows now; `null` when it shows every one. */
  applicationIds: string[] | null;
  disabled: boolean;
}) {
  return (
    <ExportMenu
      name="scores"
      disabled={disabled}
      download={(format) =>
        exportProgramScores({
          path: { programId },
          query: { format },
          body: { applicationIds },
          parseAs: "blob",
        })
      }
    />
  );
}

export { ExportScores, ScoresToolbar };
