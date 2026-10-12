"use client";

import { ChevronRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { DataTableView, dataTableColumns } from "@/components/composites/data-table-view";
import { Badge } from "@/components/ui/badge";
import { useNotify } from "@/hooks/use-notify";
import { Link } from "@/i18n/navigation";
import { decideApplications } from "@/lib/api/generated";

/** One application as the list shows it, its words already formatted. */
type ReviewRow = {
  id: string;
  href: string;
  solution: string;
  applicant: string;
  choice: string | null;
  submitted: string;
  /** For an operator: how many scored it, and the mean. */
  scores: string | null;
  /** The decision for an operator, the caller's own score for a judge. */
  status: { label: string; variant: "success" | "outline" | "warning" | "info" };
  /** The caller's own application, or their organization's: never selected for a decision. */
  own: boolean;
};

type Decision = "shortlisted" | "not_selected";

/** From this many applications on, a decision on several at once is asked again first. */
const ASK_FROM = 5;

type ReviewTableProps = {
  programId: string;
  /** The page of applications to show. */
  rows: ReviewRow[];
  /** Every application the search matches, on every page, that the operator may decide on. */
  matching: string[];
  sortKeys: readonly string[];
  defaultSort: string;
  /** The label of the program's first one-choice question, the column its answer fills. */
  choiceLabel: string | null;
  /** An operator selects applications and decides on them together. */
  operator: boolean;
  /** The decisions no longer change once the outcomes are released. */
  released: boolean;
};

const column = dataTableColumns<ReviewRow>();

/**
 * A program's applications as a table, each opening its review, sorted by a column header. An
 * operator ticks several, or every one the search matches, and shortlists them or marks them not
 * selected at once; five or more are asked again first. A judge only opens them.
 */
function ReviewTable({
  programId,
  rows,
  matching,
  sortKeys,
  defaultSort,
  choiceLabel,
  operator,
  released,
}: ReviewTableProps) {
  const t = useTranslations("Review.list");
  const notify = useNotify();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [asking, setAsking] = useState<{ decision: Decision; ids: string[]; clear: () => void }>();

  async function decide(decision: Decision, ids: string[], clear: () => void) {
    setPending(true);
    try {
      await decideApplications({
        path: { programId },
        body: { applicationIds: ids, decision, reason: null },
      });
      notify.success(`Review.list.decided.${decision}`, { count: ids.length });
      clear();
      router.refresh();
    } catch (error) {
      notify.failure(error);
    } finally {
      setPending(false);
      setAsking(undefined);
    }
  }

  function request(decision: Decision, ids: string[], clear: () => void) {
    if (ids.length >= ASK_FROM) {
      setAsking({ decision, ids, clear });
    } else {
      void decide(decision, ids, clear);
    }
  }

  const columns = column.columns([
    column.accessor("solution", {
      id: "applicant",
      header: t("columns.applicant"),
      meta: { fill: true },
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
          {/* A name cut by the column is whole in its title. */}
          <Link
            href={row.original.href}
            title={row.original.solution}
            className="truncate rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {row.original.solution}
          </Link>
          <span title={row.original.applicant} className="truncate text-muted-foreground">
            {row.original.applicant}
          </span>
        </div>
      ),
    }),
    ...(choiceLabel
      ? [
          column.accessor("choice", {
            header: choiceLabel,
            meta: { from: "lg" },
            cell: ({ getValue }) => getValue() ?? "—",
          }),
        ]
      : []),
    column.accessor("submitted", {
      header: t("columns.submitted"),
      meta: { nowrap: true },
    }),
    ...(operator
      ? [
          column.accessor("scores", {
            id: "score",
            header: t("columns.scores"),
            meta: { nowrap: true, descFirst: true },
          }),
        ]
      : []),
    column.accessor("status", {
      header: operator ? t("columns.status") : t("columns.yourAverage"),
      cell: ({ getValue }) => <Badge variant={getValue().variant}>{getValue().label}</Badge>,
    }),
    column.display({
      id: "open",
      header: () => <span className="sr-only">{t("columns.open")}</span>,
      meta: { width: "action" },
      cell: ({ row }) => (
        <Link
          href={row.original.href}
          aria-label={t("openNamed", { name: row.original.solution })}
          className="inline-flex size-8 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRightIcon aria-hidden="true" className="size-4" />
        </Link>
      ),
    }),
  ]);

  return (
    <div className="flex flex-col gap-3">
      <DataTableView
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        sortKeys={sortKeys}
        defaultSort={defaultSort}
        selection={
          operator && !released
            ? {
                canSelect: (row) => !row.own,
                name: (row) => row.solution,
                matching,
                actions: (ids, clear) => (
                  <>
                    <Button
                      size="sm"
                      pending={pending && !asking}
                      onClick={() => request("shortlisted", ids, clear)}
                    >
                      {t("selection.shortlist")}
                    </Button>
                    <Button
                      size="sm"
                      prominence="secondary"
                      disabled={pending}
                      onClick={() => request("not_selected", ids, clear)}
                    >
                      {t("selection.notSelected")}
                    </Button>
                  </>
                ),
              }
            : undefined
        }
      />

      <ConfirmDialog
        open={asking !== undefined}
        onOpenChange={(open) => (open ? undefined : setAsking(undefined))}
        title={
          asking
            ? t(`selection.confirm.${asking.decision}.title`, { count: asking.ids.length })
            : ""
        }
        description={asking ? t(`selection.confirm.${asking.decision}.lead`) : ""}
        note={t("selection.confirm.note")}
        confirmLabel={
          asking
            ? t(`selection.confirm.${asking.decision}.confirm`, { count: asking.ids.length })
            : ""
        }
        cancelLabel={t("selection.confirm.cancel")}
        pending={pending}
        onConfirm={() => asking && void decide(asking.decision, asking.ids, asking.clear)}
      />
    </div>
  );
}

export { ReviewTable, type ReviewRow };
