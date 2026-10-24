import { FileTextIcon, SearchXIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { createSerializer } from "nuqs/server";

import { Button } from "@/components/actions/button";
import { RowMenuTrigger } from "@/components/actions/row-menu-trigger";
import { DataTableEmpty } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { FeaturedBadge } from "@/components/composites/featured-badge";
import { ListFooter } from "@/components/composites/list-footer";
import { ReviewStatus } from "@/components/composites/review-status";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useFormatter } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import type { AdminUseCaseList } from "@/lib/api/generated";
import { adminUseCaseAccessRoute, siteRoutes } from "@/lib/site";
import { OrganizationMark } from "@/features/organization/organization-mark";

import { AdminUseCaseFeature } from "./admin-use-case-feature";
import { AdminUseCaseVisibility } from "./admin-use-case-visibility";
import {
  adminUseCaseSortKeys,
  adminUseCasesSearch,
  type AdminUseCasesSearch,
} from "./admin-use-cases-search";
import { AdminUseCasesToolbar } from "./admin-use-cases-toolbar";
import { LiveRefresh } from "./live-refresh";
import { adminUseCaseFilters } from "./admin-use-case-queries";
import { ExportUseCases } from "./export-use-cases";

const address = createSerializer(adminUseCasesSearch);

type AdminUseCasesPageProps = {
  useCases: AdminUseCaseList;
  search: AdminUseCasesSearch;
};

/**
 * Admin › Use cases: every use case in any status, the newest first. The list arrives already
 * read; search, the filters and paging are the URL.
 */
function AdminUseCasesPage({ useCases, search }: AdminUseCasesPageProps) {
  const t = useTranslations("Admin.useCases");
  const format = useFormatter();
  const locale = useLocale();

  const day = (instant: string) => format.dateTime(new Date(instant), "date");

  const rows = useCases.items.map((useCase) => ({
    id: useCase.id,
    title: (
      <div className="flex min-w-0 items-center gap-3">
        <OrganizationMark
          name={useCase.organization.name}
          logoFileId={useCase.organization.logoFileId}
          size="sm"
        />
        <div className="grid min-w-0 text-sm">
          <Link
            href={`${siteRoutes.adminUseCases}/${useCase.id}`}
            className="truncate rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {useCase.title ?? t("untitled")}
          </Link>
          {useCase.status === "draft" ? (
            <span className="truncate text-muted-foreground">
              {t("note.draft", { organization: useCase.organization.name })}
            </span>
          ) : useCase.status === "approved" ||
            useCase.status === "private" ||
            useCase.status === "closed" ? (
            <span className="truncate text-muted-foreground">{t(`note.${useCase.status}`)}</span>
          ) : null}
        </div>
      </div>
    ),
    organization: <span className="text-muted-foreground">{useCase.organization.name}</span>,
    status: (
      <span className="flex flex-col items-start gap-1">
        <ReviewStatus state={useCase.status}>{t(`status.${useCase.status}`)}</ReviewStatus>
        {useCase.featuredAt && <FeaturedBadge>{t("feature.featured")}</FeaturedBadge>}
      </span>
    ),
    closes: <span className="font-medium">{useCase.closesAt ? day(useCase.closesAt) : "—"}</span>,
    updated: <span className="text-muted-foreground">{day(useCase.updatedAt)}</span>,
    actions: (
      <DropdownMenu>
        <RowMenuTrigger aria-label={t("actions.open", { name: useCase.title ?? t("untitled") })} />
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuItem render={<Link href={`${siteRoutes.adminUseCases}/${useCase.id}`} />}>
              {t(useCase.status === "in_review" ? "actions.review" : "actions.view")}
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href={adminUseCaseAccessRoute(useCase.id)} />}>
              {t("actions.access")}
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<Link href={`${siteRoutes.adminOrganizations}/${useCase.organization.id}`} />}
            >
              {t("actions.organisation")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {(useCase.status === "approved" ||
              useCase.status === "private" ||
              useCase.status === "draft" ||
              useCase.status === "needs_changes") && (
              <AdminUseCaseVisibility
                id={useCase.id}
                title={useCase.title ?? t("untitled")}
                status={useCase.status}
                appearance="item"
              />
            )}
            <AdminUseCaseFeature
              id={useCase.id}
              title={useCase.title ?? t("untitled")}
              featured={Boolean(useCase.featuredAt)}
              appearance="item"
            />
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  }));

  const filtered =
    search.q.trim() !== "" ||
    search.status !== null ||
    search.organization !== null ||
    search.featured !== null;
  const empty =
    rows.length > 0 ? null : filtered ? (
      <DataTableEmpty icon={<SearchXIcon aria-hidden="true" />} title={t("noMatch.title")}>
        <Button prominence="secondary" size="sm" href={siteRoutes.adminUseCases}>
          {t("noMatch.clear")}
        </Button>
      </DataTableEmpty>
    ) : (
      <DataTableEmpty icon={<FileTextIcon aria-hidden="true" />} title={t("empty.title")} />
    );

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <LiveRefresh />
      <AdminPageHeader
        destination="useCases"
        title={t("title")}
        actions={
          <>
            <ExportUseCases filters={adminUseCaseFilters(search)} disabled={useCases.total === 0} />
            <Button href={siteRoutes.adminUseCasesNew}>{t("create")}</Button>
          </>
        }
      />
      <AdminUseCasesToolbar organizations={useCases.organizations} />

      {/* The Updated column gives way first where the table is made to fit. */}
      <DataTableRows
        sortKeys={adminUseCaseSortKeys}
        columns={[
          { id: "title", header: t("columns.useCase"), layout: { fill: true } },
          { id: "organization", header: t("columns.organization"), layout: { width: "md" } },
          { id: "status", header: t("columns.status"), layout: { width: "md" } },
          { id: "closes", header: t("columns.closes"), layout: { width: "md" } },
          { id: "updated", header: t("columns.updated"), layout: { width: "sm", from: "xl" } },
          {
            id: "actions",
            header: <span className="sr-only">{t("columns.actions")}</span>,
            layout: { width: "action" },
          },
        ]}
        rows={rows.map((row) => ({
          id: row.id,
          cells: {
            title: row.title,
            organization: row.organization,
            status: row.status,
            closes: row.closes,
            updated: row.updated,
            actions: <div className="flex justify-end">{row.actions}</div>,
          },
        }))}
        empty={empty}
      />

      <ListFooter
        count={
          t("count", { count: useCases.total }) +
          (useCases.inReview > 0 ? ` · ${t("inReview", { count: useCases.inReview })}` : "")
        }
        page={useCases.page}
        pageSize={useCases.pageSize}
        total={useCases.total}
        href={(page) => address(siteRoutes.adminUseCases, { ...search, page })}
      />
    </div>
  );
}

export { AdminUseCasesPage };
