import { Building2Icon, SearchXIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { createSerializer } from "nuqs/server";

import { Button } from "@/components/actions/button";
import { DataTable, DataTableEmpty } from "@/components/composites/data-table";
import { ListFooter } from "@/components/composites/list-footer";
import { Person } from "@/components/composites/person";
import { Status } from "@/components/composites/status";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type { AdminOrganizationList } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { AdminCreateOrganization } from "./admin-create-organization";
import { AdminOrganizationRowActions } from "./admin-organization-row-actions";
import {
  adminOrganizationsSearch,
  type AdminOrganizationsSearch,
} from "./admin-organizations-search";
import { AdminOrganizationsToolbar } from "./admin-organizations-toolbar";

const address = createSerializer(adminOrganizationsSearch);

/** How each state of the review reads to the operator who decides it. */
const tones = { pending: "warning", approved: "success", rejected: "destructive" } as const;

/** The tone of what waits for the operator: a first review, or a claim to own an organization. */
const requestTones = { new: "info", claim: "warning" } as const;

type AdminOrganizationsPageProps = {
  organizations: AdminOrganizationList;
  search: AdminOrganizationsSearch;
};

/**
 * Admin › Organisations: every organization, those waiting for review first. The list arrives
 * already read; search, the filter and paging are the URL. A decision is made in a dialog from the
 * row's menu.
 */
function AdminOrganizationsPage({ organizations, search }: AdminOrganizationsPageProps) {
  const t = useTranslations("Admin.organizations");
  const typeName = useVocabulary("organizationType");
  const countryName = useCountryName();
  const format = useFormatter();
  const locale = useLocale();

  const rows = organizations.items.map((organization) => ({
    id: organization.id,
    organization: (
      <Person
        name={organization.name}
        email={[
          typeName(organization.type),
          organization.country && countryName(organization.country),
          organization.owned ? t("members", { count: organization.members }) : t("unowned"),
        ]
          .filter(Boolean)
          .join(" · ")}
      />
    ),
    request: organization.request ? (
      <Status appearance="pill" tone={requestTones[organization.request]}>
        {t(`request.${organization.request}`)}
      </Status>
    ) : (
      <span className="text-muted-foreground">{t("request.none")}</span>
    ),
    status: (
      <Status appearance="pill" tone={tones[organization.status]}>
        {t(`status.${organization.status}`)}
      </Status>
    ),
    askedBy: (
      <span className="block truncate text-muted-foreground">
        {organization.askedBy ?? t("request.none")}
      </span>
    ),
    received: (
      <span className="text-muted-foreground">
        {format.dateTime(new Date(organization.requestedAt ?? organization.createdAt), {
          dateStyle: "medium",
        })}
      </span>
    ),
    actions: <AdminOrganizationRowActions organization={organization} />,
  }));

  const queue = search.q.trim() === "" && search.status === "pending";
  const filtered = search.q.trim() !== "" || search.status !== null;
  const empty =
    rows.length > 0 ? null : queue ? (
      <DataTableEmpty
        icon={<Building2Icon aria-hidden="true" />}
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
        <Button prominence="secondary" size="sm" href={siteRoutes.adminOrganizations}>
          {t("noMatch.clear")}
        </Button>
      </DataTableEmpty>
    ) : (
      <DataTableEmpty
        icon={<Building2Icon aria-hidden="true" />}
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
        <AdminCreateOrganization />
      </div>
      <AdminOrganizationsToolbar />

      {/* From 768px: a table. The Received column gives way first, then who asked. */}
      <DataTable className="hidden md:block">
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.organization")}</TableHead>
            <TableHead className="w-36">{t("columns.request")}</TableHead>
            <TableHead className="w-36">{t("columns.status")}</TableHead>
            <TableHead className="hidden w-56 lg:table-cell">{t("columns.askedBy")}</TableHead>
            <TableHead className="hidden w-32 xl:table-cell">{t("columns.received")}</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">{t("columns.actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="max-w-0">{row.organization}</TableCell>
              <TableCell>{row.request}</TableCell>
              <TableCell>{row.status}</TableCell>
              <TableCell className="hidden max-w-0 lg:table-cell">{row.askedBy}</TableCell>
              <TableCell className="hidden xl:table-cell">{row.received}</TableCell>
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

      {/* Below 768px: one stacked row per organization, never a table scrolled sideways. */}
      <ul className="overflow-hidden rounded-lg border md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-2 border-b p-3 last:border-b-0">
            <div className="flex items-start justify-between gap-3">
              {row.organization}
              {row.actions}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-11 text-sm">
              {row.status}
              {row.request}
              {row.received}
            </div>
          </li>
        ))}
        {empty && <li>{empty}</li>}
      </ul>

      <ListFooter
        count={t(queue ? "needReview" : "count", { count: organizations.total })}
        page={organizations.page}
        pageSize={organizations.pageSize}
        total={organizations.total}
        href={(page) => address(siteRoutes.adminOrganizations, { ...search, page })}
      />
    </div>
  );
}

export { AdminOrganizationsPage };
