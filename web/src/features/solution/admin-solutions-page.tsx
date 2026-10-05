import { BoxesIcon, SearchXIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { createSerializer } from "nuqs/server";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { DataTable, DataTableEmpty } from "@/components/composites/data-table";
import { ListFooter } from "@/components/composites/list-footer";
import { ReviewStatus } from "@/components/composites/review-status";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useVocabulary } from "@/i18n/vocabulary";
import type { AdminSolutionList } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { adminSolutionsSearch, type AdminSolutionsSearch } from "./solutions-search";
import { SolutionsToolbar } from "./solutions-toolbar";

const address = createSerializer(adminSolutionsSearch);

type AdminSolutionsPageProps = {
  solutions: AdminSolutionList;
  search: AdminSolutionsSearch;
};

/**
 * Admin › Solutions: every solution that was submitted, those waiting for review first and the
 * longest wait on top. The list arrives already read; search, the filter and paging are the URL.
 */
function AdminSolutionsPage({ solutions, search }: AdminSolutionsPageProps) {
  const t = useTranslations("Admin.solutions");
  const status = useVocabulary("reviewStatus");
  const maturity = useVocabulary("maturity");
  const format = useFormatter();
  const locale = useLocale();

  const rows = solutions.items.map((solution) => ({
    id: solution.id,
    href: `${siteRoutes.adminSolutions}/${solution.id}`,
    name: solution.name,
    organization: solution.organizationName,
    maturity: solution.maturity ? maturity(solution.maturity) : t("notStated"),
    status: (
      <span className="flex flex-col items-start gap-0.5">
        <ReviewStatus state={solution.status}>{status(solution.status)}</ReviewStatus>
        {solution.deploymentsAwaitingReview > 0 && (
          <span className="text-xs text-muted-foreground">
            {t("deploymentsWaiting", { count: solution.deploymentsAwaitingReview })}
          </span>
        )}
      </span>
    ),
    // A record that waits says for how long; a decided one keeps the day it was sent.
    submitted: !solution.submittedAt
      ? ""
      : solution.status === "submitted"
        ? t("waitingSince", { time: format.relativeTime(new Date(solution.submittedAt)) })
        : format.dateTime(new Date(solution.submittedAt), { dateStyle: "medium" }),
    waiting: solution.status === "submitted" || solution.deploymentsAwaitingReview > 0,
  }));

  const filtered = search.q.trim() !== "" || search.status !== null;
  const empty =
    rows.length > 0 ? null : search.q.trim() === "" && search.status === "submitted" ? (
      <DataTableEmpty
        icon={<BoxesIcon aria-hidden="true" />}
        title={t("queueEmpty.title")}
        description={t("queueEmpty.description")}
      >
        <Button prominence="secondary" size="sm" href={siteRoutes.admin}>
          {t("queueEmpty.home")}
        </Button>
      </DataTableEmpty>
    ) : filtered ? (
      <DataTableEmpty
        icon={<SearchXIcon aria-hidden="true" />}
        title={t("noMatch.title")}
        description={t("noMatch.description")}
      >
        <Button prominence="secondary" size="sm" href={siteRoutes.adminSolutions}>
          {t("noMatch.clear")}
        </Button>
      </DataTableEmpty>
    ) : (
      <DataTableEmpty
        icon={<BoxesIcon aria-hidden="true" />}
        title={t("empty.title")}
        description={t("empty.description")}
      />
    );
  const open = (row: (typeof rows)[number]) => (
    <TextButton href={row.href} aria-label={t("openNamed", { name: row.name })}>
      {t(row.waiting ? "review.open" : "open")}
    </TextButton>
  );

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("lead")}</p>
      </div>
      <SolutionsToolbar list="admin" />

      {/* From 768px: a table. The Maturity column gives way first. */}
      <DataTable className="hidden md:block">
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.solution")}</TableHead>
            <TableHead className="hidden xl:table-cell">{t("columns.maturity")}</TableHead>
            <TableHead>{t("columns.status")}</TableHead>
            <TableHead>{t("columns.submitted")}</TableHead>
            <TableHead>
              <span className="sr-only">{t("columns.actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{row.name}</span>
                  <span className="text-muted-foreground">{row.organization}</span>
                </div>
              </TableCell>
              <TableCell className="hidden xl:table-cell">{row.maturity}</TableCell>
              <TableCell>{row.status}</TableCell>
              <TableCell>
                <span className="text-muted-foreground">{row.submitted}</span>
              </TableCell>
              <TableCell>
                <div className="flex justify-end">{open(row)}</div>
              </TableCell>
            </TableRow>
          ))}
          {empty && (
            <TableRow>
              <TableCell colSpan={5}>{empty}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </DataTable>

      {/* Below 768px: one stacked row per solution, never a table scrolled sideways. */}
      <ul className="overflow-hidden rounded-lg border md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-2 border-b p-3 last:border-b-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{row.name}</span>
                <span className="truncate text-sm text-muted-foreground">{row.organization}</span>
              </div>
              {open(row)}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {row.status}
              <span className="text-xs text-muted-foreground">{row.submitted}</span>
            </div>
          </li>
        ))}
        {empty && <li>{empty}</li>}
      </ul>

      <ListFooter
        count={t("count", { count: solutions.total })}
        page={solutions.page}
        pageSize={solutions.pageSize}
        total={solutions.total}
        href={(page) => address(siteRoutes.adminSolutions, { ...search, page })}
      />
    </div>
  );
}

export { AdminSolutionsPage };
