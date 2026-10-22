"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { DataTableView, dataTableColumns } from "@/components/composites/data-table-view";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { ProgramScorer, ProgramScoresRow } from "@/lib/api/generated";
import { cn } from "@/lib/utils";

import { scorerKey, type ScorerSummary } from "./scores-search";

const applicationColumn = dataTableColumns<ProgramScoresRow>();
const judgeColumn = dataTableColumns<ScorerSummary>();

/** A score with one decimal, or a dash when there is none. */
function shown(value: number | null | undefined) {
  return value == null ? "—" : value.toFixed(1);
}

type ScoresByApplicationProps = {
  rows: ProgramScoresRow[];
  scorers: ProgramScorer[];
  /** Where the applications open, each under it with `query`. */
  base: string;
  /** The search an application keeps, as the query of its address. */
  query: string;
  sortKeys: readonly string[];
  defaultSort: string;
  /** From this spread on, the judges disagree enough to be marked. */
  wide: number;
};

/**
 * The shortlist against every scorer. The application, the mean across scorers, the spread, marked
 * when the judges are far apart, and how many scored lead and stay in view; then each scorer is a
 * column with their mean over the criteria, or a dash where they have not scored. On a marked row the highest score and the lowest are tinted, so the judge who
 * pulls it up or down shows. Every column sorts; a row opens the application, where the scores by
 * criterion and the notes are.
 */
function ScoresByApplication({
  rows,
  scorers,
  base,
  query,
  sortKeys,
  defaultSort,
  wide,
}: ScoresByApplicationProps) {
  const t = useTranslations("Review.scores");

  const columns = applicationColumn.columns([
    applicationColumn.accessor("solution", {
      id: "applicant",
      header: t("columns.application"),
      // The application and the three numbers a deliberation reads stay in view while the
      // judges scroll under them.
      meta: { pin: 0 },
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
          <Link
            href={`${base}/${row.original.id}${query}`}
            title={row.original.solution}
            className="truncate rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {row.original.solution}
          </Link>
          <span title={row.original.organization} className="truncate text-muted-foreground">
            {row.original.organization}
          </span>
        </div>
      ),
    }),
    applicationColumn.accessor("average", {
      header: t("columns.average"),
      meta: { numeric: true, nowrap: true, descFirst: true, pin: 1 },
      cell: ({ getValue }) => <span className="font-medium">{shown(getValue())}</span>,
    }),
    applicationColumn.accessor("spread", {
      header: t("columns.spread"),
      meta: { numeric: true, nowrap: true, descFirst: true, pin: 2 },
      cell: ({ getValue }) => {
        const spread = getValue();
        return spread != null && spread >= wide ? (
          <span className="inline-flex items-center gap-1 font-medium">
            <TriangleAlertIcon aria-hidden="true" className="size-3.5 text-warning" />
            {shown(spread)}
            <span className="sr-only">{t("wide")}</span>
          </span>
        ) : (
          shown(spread)
        );
      },
    }),
    applicationColumn.accessor("scored", {
      header: t("columns.scored"),
      meta: { numeric: true, nowrap: true, descFirst: true, pin: 3 },
    }),
    ...scorers.map((scorer) =>
      applicationColumn.display({
        id: scorerKey(scorer.accountId),
        // A long name is cut short; the whole of it and the address are in its title.
        header: () => (
          <span
            title={`${scorer.name} · ${scorer.email}`}
            className="flex max-w-28 flex-col items-end"
          >
            <span className="max-w-full truncate">{scorer.name}</span>
            {scorer.role === "operator" && (
              <span className="font-normal text-muted-foreground">{t("role.operator")}</span>
            )}
          </span>
        ),
        meta: { numeric: true, nowrap: true, descFirst: true },
        cell: ({ row }) => {
          const cell = row.original.scores.find((item) => item.accountId === scorer.accountId);
          if (!cell) {
            return <span className="text-muted-foreground">—</span>;
          }
          const given = row.original.scores.map((item) => item.score);
          const marked = (row.original.spread ?? 0) >= wide;
          const highest = marked && cell.score === Math.max(...given);
          const lowest = marked && cell.score === Math.min(...given);
          return (
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5",
                highest && "bg-success/10 font-medium",
                lowest && "bg-destructive/10 font-medium",
              )}
            >
              {shown(cell.score)}
              {(highest || lowest) && (
                <span className="sr-only">{t(highest ? "highest" : "lowest")}</span>
              )}
            </span>
          );
        },
      }),
    ),
  ]);

  return (
    <DataTableView
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      sortKeys={sortKeys}
      defaultSort={defaultSort}
    />
  );
}

/**
 * Each scorer's work over the shortlist the search keeps: how many they scored, how many still wait
 * for a judge, and their mean, which shows a strict or a generous judge beside the others.
 */
function ScoresByJudge({ judges }: { judges: ScorerSummary[] }) {
  const t = useTranslations("Review.scores");

  const columns = judgeColumn.columns([
    judgeColumn.accessor((summary) => summary.scorer.name, {
      id: "name",
      header: t("columns.judge"),
      meta: { fill: true },
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{row.original.scorer.name}</span>
          <span className="truncate text-muted-foreground">{row.original.scorer.email}</span>
        </div>
      ),
    }),
    judgeColumn.accessor((summary) => summary.scorer.role, {
      id: "role",
      header: t("columns.role"),
      cell: ({ getValue }) => <Badge variant="outline">{t(`role.${getValue()}`)}</Badge>,
    }),
    judgeColumn.accessor("scored", {
      header: t("columns.scored"),
      meta: { numeric: true, nowrap: true },
    }),
    judgeColumn.accessor("waiting", {
      header: t("columns.waiting"),
      meta: { numeric: true, nowrap: true },
      cell: ({ getValue }) => getValue() ?? "—",
    }),
    judgeColumn.accessor("mean", {
      header: t("columns.mean"),
      meta: { numeric: true, nowrap: true },
      cell: ({ getValue }) => <span className="font-medium">{shown(getValue())}</span>,
    }),
  ]);

  return <DataTableView columns={columns} data={judges} getRowId={(row) => row.scorer.accountId} />;
}

export { ScoresByApplication, ScoresByJudge };
