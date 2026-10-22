"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { DataTableView, dataTableColumns } from "@/components/composites/data-table-view";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { ProgramScorer, ProgramScoresRow } from "@/lib/api/generated";

import { scorerKey, type ScorerSummary } from "./scores-search";

const applicationColumn = dataTableColumns<ProgramScoresRow>();
const judgeColumn = dataTableColumns<ScorerSummary>();

/** A score with one decimal, or a dash when there is none. */
function shown(value: number | null | undefined) {
  return value == null ? "—" : value.toFixed(1);
}

const decisionVariant = {
  shortlisted: "success",
  not_selected: "outline",
  under_review: "warning",
} as const;

type ScoresByApplicationProps = {
  rows: ProgramScoresRow[];
  scorers: ProgramScorer[];
  /** Where the applications open, each under it with `query`. */
  base: string;
  /** The tab and search an application keeps, as the query of its address. */
  query: string;
  sortKeys: readonly string[];
  defaultSort: string;
  /** From this spread on, the judges disagree enough to be marked. */
  wide: number;
};

/**
 * A program's applications against every scorer: each scorer a column with their mean over the
 * criteria, Conflict where they stepped back and a dash where they have not scored; then the mean
 * across them, how many scored and the spread, marked when the judges are far apart. Every column
 * sorts; a row opens the application, where the scores by criterion and the notes are.
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
  const decisions = useTranslations("Review.list.decision");

  const columns = applicationColumn.columns([
    applicationColumn.accessor("solution", {
      id: "applicant",
      header: t("columns.application"),
      meta: { fill: true },
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
    applicationColumn.accessor("reviewStatus", {
      id: "decision",
      header: t("columns.decision"),
      meta: { from: "lg" },
      cell: ({ getValue }) => (
        <Badge variant={decisionVariant[getValue()]}>{decisions(getValue())}</Badge>
      ),
    }),
    ...scorers.map((scorer) =>
      applicationColumn.display({
        id: scorerKey(scorer.accountId),
        header: () => (
          <span title={scorer.email} className="flex flex-col">
            <span>{scorer.name}</span>
            {scorer.role === "operator" && (
              <span className="font-normal text-muted-foreground">{t("role.operator")}</span>
            )}
          </span>
        ),
        meta: { numeric: true, nowrap: true, descFirst: true },
        cell: ({ row }) => {
          const cell = row.original.scores.find((item) => item.accountId === scorer.accountId);
          return cell?.conflict ? (
            <span className="text-muted-foreground">{t("conflict")}</span>
          ) : (
            <span className={cell ? undefined : "text-muted-foreground"}>{shown(cell?.score)}</span>
          );
        },
      }),
    ),
    applicationColumn.accessor("average", {
      header: t("columns.average"),
      meta: { numeric: true, nowrap: true, descFirst: true },
      cell: ({ getValue }) => <span className="font-medium">{shown(getValue())}</span>,
    }),
    applicationColumn.accessor("scored", {
      header: t("columns.scored"),
      meta: { numeric: true, nowrap: true, descFirst: true, from: "xl" },
    }),
    applicationColumn.accessor("spread", {
      header: t("columns.spread"),
      meta: { numeric: true, nowrap: true, descFirst: true },
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
 * Each scorer's work over the applications the search keeps: how many they scored and stepped back
 * from, how many of the shortlist still wait for a judge, and their mean, which shows a strict or a
 * generous judge beside the others.
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
    judgeColumn.accessor("conflicts", {
      header: t("columns.conflicts"),
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
