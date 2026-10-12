import { BoxesIcon, EllipsisIcon, SearchXIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { createSerializer } from "nuqs/server";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { DataTableEmpty } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { ListFooter } from "@/components/composites/list-footer";
import { FeaturedBadge } from "@/components/composites/featured-badge";
import { ReviewStatus, reviewState } from "@/components/composites/review-status";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { useVocabulary } from "@/i18n/vocabulary";
import type { AdminSolutionList, AdminSolutionSummary } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { CreateAdminSolution } from "./create-admin-solution";
import { SolutionLogo } from "./solution-logo";
import { SolutionFeature } from "./solution-feature";
import {
  adminSolutionSortKeys,
  adminSolutionsSearch,
  type AdminSolutionsSearch,
} from "./solutions-search";
import { SolutionsToolbar } from "./solutions-toolbar";

const address = createSerializer(adminSolutionsSearch);

type AdminSolutionsPageProps = {
  solutions: AdminSolutionList;
  search: AdminSolutionsSearch;
};

/**
 * Admin › Solutions: every solution that was submitted, those waiting for review first and the
 * longest wait on top. The list arrives already read; search, the filters and paging are the URL.
 */
function AdminSolutionsPage({ solutions, search }: AdminSolutionsPageProps) {
  const t = useTranslations("Admin.solutions");
  const status = useVocabulary("reviewStatus");
  const format = useFormatter();
  const locale = useLocale();

  const rows = solutions.items.map((solution) => ({
    id: solution.id,
    solution,
    href: `${siteRoutes.adminSolutions}/${solution.id}`,
    name: solution.name,
    logoFileId: solution.logoFileId,
    summary: solution.summary,
    organization: solution.organizationName,
    // A solution sent before the sender was recorded says so, rather than showing nothing.
    sender: solution.submittedBy ?? t("senderUnknown"),
    status: (
      <span className="flex flex-col items-start gap-0.5">
        <ReviewStatus state={reviewState(solution)}>{status(reviewState(solution))}</ReviewStatus>
        {solution.deploymentsAwaitingReview > 0 && (
          <span className="text-xs text-muted-foreground">
            {t("deploymentsWaiting", { count: solution.deploymentsAwaitingReview })}
          </span>
        )}
        {solution.featuredAt && <FeaturedBadge>{t("feature.featured")}</FeaturedBadge>}
      </span>
    ),
    // A record that waits says for how long; a decided one keeps the day it was sent.
    submitted: !solution.submittedAt
      ? ""
      : solution.status === "in_review"
        ? t("waitingSince", { time: format.relativeTime(new Date(solution.submittedAt)) })
        : format.dateTime(new Date(solution.submittedAt), { dateStyle: "medium" }),
    waiting: solution.status === "in_review" || solution.deploymentsAwaitingReview > 0,
  }));

  const narrowed =
    search.organizationId !== null ||
    search.status !== null ||
    search.industry !== null ||
    search.featured !== null;
  const filtered = search.q.trim() !== "" || narrowed;
  const empty =
    rows.length > 0 ? null : search.q.trim() === "" &&
      search.status === "in_review" &&
      search.organizationId === null &&
      search.industry === null &&
      search.featured === null ? (
      <DataTableEmpty icon={<BoxesIcon aria-hidden="true" />} title={t("queueEmpty.title")}>
        <Button prominence="secondary" size="sm" href={siteRoutes.admin}>
          {t("queueEmpty.home")}
        </Button>
      </DataTableEmpty>
    ) : filtered ? (
      <DataTableEmpty icon={<SearchXIcon aria-hidden="true" />} title={t("noMatch.title")}>
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

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <AdminPageHeader
        destination="solutions"
        title={t("title")}
        lead={t("lead")}
        actions={
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {/* How much waits, whatever the list is narrowed to, and the way to only that. */}
            {solutions.awaitingReview > 0 &&
              (search.status === "in_review" ? (
                <span className="text-sm font-medium">
                  {t("awaiting", { count: solutions.awaitingReview })}
                </span>
              ) : (
                <TextButton href={address(siteRoutes.adminSolutions, { status: "in_review" })}>
                  {t("awaiting", { count: solutions.awaitingReview })}
                </TextButton>
              ))}
            <CreateAdminSolution />
          </div>
        }
      />
      <SolutionsToolbar list="admin" organizationOptions={solutions.organizations} />

      {/* From 768px: a table. The sender gives way first, then the organization joins the solution. */}
      <DataTableRows
        sortKeys={adminSolutionSortKeys}
        className="hidden md:flex"
        columns={[
          // The one column that gives its width up: a long name or summary is cut, not wrapped.
          { id: "name", header: t("columns.solution"), layout: { fill: true } },
          { id: "organization", header: t("columns.organization"), layout: { from: "lg" } },
          { id: "status", header: t("columns.status") },
          { id: "sentBy", header: t("columns.sentBy"), layout: { from: "xl" } },
          { id: "submitted", header: t("columns.waiting"), layout: { descFirst: true } },
          { id: "actions", header: <span className="sr-only">{t("columns.actions")}</span> },
        ]}
        rows={rows.map((row) => ({
          id: row.id,
          cells: {
            name: (
              <div className="flex min-w-0 items-center gap-3">
                <SolutionLogo name={row.name} fileId={row.logoFileId} size="row" />
                <div className="flex min-w-0 flex-col">
                  <Link
                    href={row.href}
                    className="truncate rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {row.name}
                  </Link>
                  <span className="truncate text-muted-foreground lg:hidden">
                    {row.organization}
                  </span>
                  {row.summary && (
                    <span className="hidden truncate text-muted-foreground lg:block">
                      {row.summary}
                    </span>
                  )}
                </div>
              </div>
            ),
            organization: row.organization,
            status: row.status,
            sentBy: row.sender,
            submitted: <span className="text-muted-foreground">{row.submitted}</span>,
            actions: (
              <div className="flex justify-end">
                <RowMenu solution={row.solution} />
              </div>
            ),
          },
        }))}
        empty={empty}
      />

      {/* Below 768px: one stacked row per solution, never a table scrolled sideways. */}
      <ul className="overflow-hidden rounded-lg border md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-2 border-b p-3 last:border-b-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <SolutionLogo name={row.name} fileId={row.logoFileId} size="row" />
                <div className="flex min-w-0 flex-col">
                  <Link
                    href={row.href}
                    className="truncate rounded-sm text-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {row.name}
                  </Link>
                  <span className="truncate text-sm text-muted-foreground">{row.organization}</span>
                </div>
              </div>
              <RowMenu solution={row.solution} />
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

/**
 * What the ⋯ menu of one row offers: the review page, the organization's own page, and featuring the
 * solution in the public directory.
 */
function RowMenu({ solution }: { solution: AdminSolutionSummary }) {
  const t = useTranslations("Admin.solutions");
  const { id, name, organizationId } = solution;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={t("openNamed", { name })}
            className="hit-area flex size-8 shrink-0 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted"
          />
        }
      >
        <EllipsisIcon className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href={`${siteRoutes.adminSolutions}/${id}`} />}>
            {t("review.open")}
          </DropdownMenuItem>
          <DropdownMenuItem
            render={<Link href={`${siteRoutes.adminOrganizations}/${organizationId}`} />}
          >
            {t("actions.organization")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <SolutionFeature solution={solution} appearance="item" />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { AdminSolutionsPage };
