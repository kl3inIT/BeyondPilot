import { EllipsisIcon, FileTextIcon, SearchXIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { createSerializer } from "nuqs/server";

import { Button } from "@/components/actions/button";
import { DataTable, DataTableEmpty } from "@/components/composites/data-table";
import { ListFooter } from "@/components/composites/list-footer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type {
  AdminUseCaseList,
  AdminUseCaseSummary,
  UseCaseOrganization,
} from "@/lib/api/generated";
import { initials } from "@/lib/initials";
import { siteRoutes } from "@/lib/site";

import { adminUseCasesSearch, type AdminUseCasesSearch } from "./admin-use-cases-search";
import { AdminUseCasesToolbar } from "./admin-use-cases-toolbar";

const address = createSerializer(adminUseCasesSearch);

/** How each status reads to the operator; draft and closed are quiet, the rest ask for attention. */
const variants = {
  draft: "secondary",
  in_review: "warning",
  needs_changes: "info",
  published: "success",
  closed: "secondary",
} as const satisfies Record<AdminUseCaseSummary["status"], string>;

type AdminUseCasesPageProps = {
  useCases: AdminUseCaseList;
  organizations: UseCaseOrganization[];
  search: AdminUseCasesSearch;
};

/**
 * Admin › Use cases: every use case in any status, the newest first. The list arrives already
 * read; search, the filters and paging are the URL.
 */
function AdminUseCasesPage({ useCases, organizations, search }: AdminUseCasesPageProps) {
  const t = useTranslations("Admin.useCases");
  const format = useFormatter();
  const locale = useLocale();

  const day = (instant: string) =>
    format.dateTime(new Date(instant), { dateStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" });

  const rows = useCases.items.map((useCase) => ({
    id: useCase.id,
    title: (
      <div className="flex min-w-0 items-center gap-3">
        <Avatar>
          <AvatarFallback>{initials(useCase.organization.name, "")}</AvatarFallback>
        </Avatar>
        <div className="grid min-w-0 text-sm">
          <Link
            href={`${siteRoutes.adminUseCases}/${useCase.id}`}
            className="truncate rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {useCase.title ?? t("untitled")}
          </Link>
          <span className="truncate text-muted-foreground">
            {t(`note.${useCase.status}`, { organization: useCase.organization.name })}
          </span>
        </div>
      </div>
    ),
    organization: <span className="text-muted-foreground">{useCase.organization.name}</span>,
    status: <Badge variant={variants[useCase.status]}>{t(`status.${useCase.status}`)}</Badge>,
    closes: <span className="font-medium">{useCase.closesAt ? day(useCase.closesAt) : "—"}</span>,
    updated: <span className="text-muted-foreground">{day(useCase.updatedAt)}</span>,
    actions: (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={t("actions.open", { name: useCase.title ?? t("untitled") })}
              className="hit-area flex size-8 shrink-0 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted"
            />
          }
        >
          <EllipsisIcon className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuItem render={<Link href={`${siteRoutes.adminUseCases}/${useCase.id}`} />}>
              {t(useCase.status === "in_review" ? "actions.review" : "actions.view")}
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<Link href={`${siteRoutes.adminOrganizations}/${useCase.organization.id}`} />}
            >
              {t("actions.organisation")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  }));

  const filtered = search.q.trim() !== "" || search.status !== null || search.organization !== null;
  const empty =
    rows.length > 0 ? null : filtered ? (
      <DataTableEmpty
        icon={<SearchXIcon aria-hidden="true" />}
        title={t("noMatch.title")}
        description={t("noMatch.description")}
      >
        <Button prominence="secondary" size="sm" href={siteRoutes.adminUseCases}>
          {t("noMatch.clear")}
        </Button>
      </DataTableEmpty>
    ) : (
      <DataTableEmpty
        icon={<FileTextIcon aria-hidden="true" />}
        title={t("empty.title")}
        description={t("empty.description")}
      />
    );

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("lead")}</p>
        </div>
        <Button href={siteRoutes.adminUseCasesNew}>{t("create")}</Button>
      </div>
      <AdminUseCasesToolbar organizations={organizations} />

      {/* From 768px: a table. The Updated column gives way first. */}
      <DataTable className="hidden md:block">
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.useCase")}</TableHead>
            <TableHead className="w-40">{t("columns.organization")}</TableHead>
            <TableHead className="w-36">{t("columns.status")}</TableHead>
            <TableHead className="w-36">{t("columns.closes")}</TableHead>
            <TableHead className="hidden w-32 xl:table-cell">{t("columns.updated")}</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">{t("columns.actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="max-w-0">{row.title}</TableCell>
              <TableCell>{row.organization}</TableCell>
              <TableCell>{row.status}</TableCell>
              <TableCell>{row.closes}</TableCell>
              <TableCell className="hidden xl:table-cell">{row.updated}</TableCell>
              <TableCell>
                <div className="flex justify-end">{row.actions}</div>
              </TableCell>
            </TableRow>
          ))}
          {empty && (
            <TableRow>
              <TableCell colSpan={6}>{empty}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </DataTable>

      {/* Below 768px: one stacked row per use case, never a table scrolled sideways. */}
      <ul className="overflow-hidden rounded-lg border md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-2 border-b p-3 last:border-b-0">
            <div className="flex items-start justify-between gap-3">
              {row.title}
              {row.actions}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-11 text-sm">
              {row.status}
              {row.organization}
              <span className="text-muted-foreground">
                {t("columns.closes")}: {row.closes}
              </span>
            </div>
          </li>
        ))}
        {empty && <li>{empty}</li>}
      </ul>

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
