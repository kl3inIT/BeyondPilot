import { SearchXIcon, TableIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { DataTableEmpty } from "@/components/composites/data-table";
import type { ProgramScores } from "@/lib/api/generated";
import { adminProgramApplicationsRoute, adminProgramScoresRoute } from "@/lib/site";

import { reviewAddress } from "./review-search";
import { scoresTable, type ScoresSearch } from "./scores-search";
import { ScoresByApplication, ScoresByJudge } from "./scores-table";
import { ExportScores, ScoresToolbar } from "./scores-toolbar";

type ProgramScoresPageProps = {
  programId: string;
  data: ProgramScores;
  search: ScoresSearch;
};

/**
 * Every judge's scores of a program's shortlist side by side, for GenAI Fund to deliberate: By
 * application, each scorer a column, the highest mean first, and By judge, each scorer's work and
 * mean. It only compares: an application opens from its row, where it is scored, and Previous and
 * Next there go through the shortlist.
 */
function ProgramScoresPage({ programId, data, search }: ProgramScoresPageProps) {
  const t = useTranslations("Review.scores");
  const table = scoresTable(data, search);
  // The application page goes on through the shortlist, the highest mean first.
  const query = reviewAddress({ tab: "shortlisted", q: search.q, sort: "-score", page: 1 });
  const applications = adminProgramApplicationsRoute(programId);

  return (
    <div className="flex flex-col gap-5">
      {/* The table says what it holds; what a mark means is on the mark and the Spread heading. */}
      <ScoresToolbar>
        <ExportScores
          programId={programId}
          applicationIds={table.rows.map((row) => row.id)}
          disabled={table.rows.length === 0}
        />
      </ScoresToolbar>
      {table.rows.length === 0 ? (
        table.shortlisted > 0 ? (
          <DataTableEmpty icon={<SearchXIcon aria-hidden="true" />} title={t("noMatch.title")}>
            <Button prominence="secondary" size="sm" href={adminProgramScoresRoute(programId)}>
              {t("noMatch.clear")}
            </Button>
          </DataTableEmpty>
        ) : (
          <DataTableEmpty
            icon={<TableIcon aria-hidden="true" />}
            title={t("empty.title")}
            description={t("empty.description")}
          />
        )
      ) : search.view === "judges" ? (
        <ScoresByJudge judges={table.judges} />
      ) : (
        <ScoresByApplication
          rows={table.rows}
          scorers={table.scorers}
          base={applications}
          query={query}
          sortKeys={table.sortKeys}
          defaultSort={table.defaultSort}
          wide={table.wide}
        />
      )}
      {/* A program takes a few hundred applications at most: they are compared on one page. */}
      <p className="text-sm text-muted-foreground tabular-nums">
        {t("footer", {
          shown: table.rows.length,
          scorers: table.scorers.length,
          scored: table.rows.filter((row) => row.scored > 0).length,
        })}
      </p>
    </div>
  );
}

export { ProgramScoresPage };
