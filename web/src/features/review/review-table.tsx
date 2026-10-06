"use client";

import { ChevronRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { DataTable } from "@/components/composites/data-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNotify } from "@/hooks/use-notify";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/client";
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

type ReviewTableProps = {
  programId: string;
  rows: ReviewRow[];
  /** The label of the program's first one-choice question, the column its answer fills. */
  choiceLabel: string | null;
  /** An operator selects applications and decides on them together. */
  operator: boolean;
  /** The decisions no longer change once the outcomes are released. */
  released: boolean;
};

/**
 * A program's applications as a table, each opening its review. An operator ticks several and
 * shortlists them or marks them not selected at once; a judge only opens them.
 */
function ReviewTable({ programId, rows, choiceLabel, operator, released }: ReviewTableProps) {
  const t = useTranslations("Review.list");
  const notify = useNotify();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const selecting = operator && !released;
  const selectable = rows.filter((row) => !row.own);
  const all = selectable.length > 0 && selectable.every((row) => selected.includes(row.id));

  async function decide(decision: "shortlisted" | "not_selected") {
    setPending(true);
    try {
      await decideApplications({
        path: { programId },
        body: { applicationIds: selected, decision, reason: null },
      });
      notify.success(`Review.list.decided.${decision}`, { count: selected.length });
      setSelected([]);
      router.refresh();
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      notify.error(
        code === "PROPOSAL_RELEASED" ? "Review.errors.released" : "Review.errors.unknown",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {selecting && selected.length > 0 && (
        <div
          role="region"
          aria-label={t("selection.label")}
          className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted px-4 py-2.5"
        >
          <span className="text-sm font-medium">
            {t("selection.count", { count: selected.length })}
          </span>
          <Button size="sm" pending={pending} onClick={() => decide("shortlisted")}>
            {t("selection.shortlist")}
          </Button>
          <Button
            size="sm"
            prominence="secondary"
            disabled={pending}
            onClick={() => decide("not_selected")}
          >
            {t("selection.notSelected")}
          </Button>
          <Button size="sm" prominence="tertiary" onClick={() => setSelected([])}>
            {t("selection.clear")}
          </Button>
        </div>
      )}

      <DataTable className="hidden md:block">
        <TableHeader>
          <TableRow>
            {selecting && (
              <TableHead className="w-10">
                <Checkbox
                  aria-label={t("selection.all")}
                  checked={all}
                  onCheckedChange={(checked) =>
                    setSelected(checked ? selectable.map((row) => row.id) : [])
                  }
                />
              </TableHead>
            )}
            <TableHead>{t("columns.applicant")}</TableHead>
            {choiceLabel && <TableHead className="hidden lg:table-cell">{choiceLabel}</TableHead>}
            <TableHead>{t("columns.submitted")}</TableHead>
            {operator && <TableHead>{t("columns.scores")}</TableHead>}
            <TableHead>{operator ? t("columns.status") : t("columns.yourAverage")}</TableHead>
            <TableHead>
              <span className="sr-only">{t("columns.open")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              {selecting && (
                <TableCell>
                  <Checkbox
                    disabled={row.own}
                    aria-label={t("selection.one", { name: row.solution })}
                    checked={selected.includes(row.id)}
                    onCheckedChange={(checked) =>
                      setSelected((current) =>
                        checked ? [...current, row.id] : current.filter((id) => id !== row.id),
                      )
                    }
                  />
                </TableCell>
              )}
              <TableCell className="w-full max-w-0">
                <div className="flex min-w-0 flex-col">
                  <Link
                    href={row.href}
                    className="truncate font-medium outline-none hover:underline focus-visible:underline"
                  >
                    {row.solution}
                  </Link>
                  <span className="truncate text-muted-foreground">{row.applicant}</span>
                </div>
              </TableCell>
              {choiceLabel && (
                <TableCell className="hidden lg:table-cell">{row.choice ?? "—"}</TableCell>
              )}
              <TableCell className="whitespace-nowrap">{row.submitted}</TableCell>
              {operator && <TableCell className="whitespace-nowrap">{row.scores}</TableCell>}
              <TableCell>
                <Badge variant={row.status.variant}>{row.status.label}</Badge>
              </TableCell>
              <TableCell>
                <Link
                  href={row.href}
                  aria-label={t("openNamed", { name: row.solution })}
                  className="inline-flex size-8 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronRightIcon aria-hidden="true" className="size-4" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </DataTable>

      {/* Below 768px: one card per application, each opening its review. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={row.href}
              className="flex flex-col gap-1 rounded-lg border bg-card p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="font-medium">{row.solution}</span>
                <Badge variant={row.status.variant}>{row.status.label}</Badge>
              </span>
              <span className="text-sm text-muted-foreground">{row.applicant}</span>
              <span className="text-sm text-muted-foreground">
                {[row.choice, row.submitted, row.scores].filter(Boolean).join(" · ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export { ReviewTable, type ReviewRow };
