import { Building2Icon, SearchXIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { createSerializer } from "nuqs/server";

import { Button } from "@/components/actions/button";
import { DataTableEmpty } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { ListFooter } from "@/components/composites/list-footer";
import { reviewState } from "@/components/composites/review-status";
import { Status } from "@/components/composites/status";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { useFormatter } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type { AdminOrganizationList } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { AdminCreateOrganization } from "./admin-create-organization";
import { AdminOrganizationRowActions } from "./admin-organization-row-actions";
import {
  adminOrganizationsSearch,
  type AdminOrganizationsSearch,
  adminOrganizationSortKeys,
} from "./admin-organizations-search";
import { AdminOrganizationsToolbar } from "./admin-organizations-toolbar";
import { ExportOrganizations } from "./export-organizations";
import { adminOrganizationFilters } from "./organization-queries";
import { OrganizationMark } from "./organization-mark";

const address = createSerializer(adminOrganizationsSearch);

/** How each state of an organization reads to the operator. */
const tones = {
  active: "success",
  suspended: "destructive",
  merged: "neutral",
} as const;

type AdminOrganizationsPageProps = {
  organizations: AdminOrganizationList;
  search: AdminOrganizationsSearch;
};

/**
 * Admin › Organisations: every organization, those with an open ownership claim first. The list
 * arrives already read; search, the filter and paging are the URL. A claim is decided from its row.
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
      <div className="flex min-w-0 items-center gap-3">
        <OrganizationMark name={organization.name} logoFileId={organization.logoFileId} size="sm" />
        <div className="grid min-w-0 text-sm">
          <Link
            href={`${siteRoutes.adminOrganizations}/${organization.id}`}
            className="relative -my-0.5 truncate rounded-sm py-0.5 font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {organization.name}
          </Link>
          <span className="truncate text-muted-foreground">
            {organization.mergedInto
              ? t("mergedInto", { name: organization.mergedInto })
              : [
                  typeName(organization.type),
                  organization.country && countryName(organization.country),
                  organization.owned ? t("members", { count: organization.members }) : t("unowned"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </span>
        </div>
      </div>
    ),
    status: (
      <Status appearance="pill" tone={tones[reviewState(organization)]}>
        {t(`status.${reviewState(organization)}`)}
      </Status>
    ),
    created: (
      <span className="text-muted-foreground">
        {format.dateTime(new Date(organization.createdAt), "date")}
      </span>
    ),
    actions: <AdminOrganizationRowActions organization={organization} />,
  }));

  const queue = search.q.trim() === "" && search.status === "claimed" && search.country === null;
  const filtered = search.q.trim() !== "" || search.status !== null || search.country !== null;
  const empty =
    rows.length > 0 ? null : queue ? (
      <DataTableEmpty icon={<Building2Icon aria-hidden="true" />} title={t("queueEmpty.title")}>
        <Button prominence="secondary" size="sm" href={siteRoutes.admin}>
          {t("queueEmpty.home")}
        </Button>
      </DataTableEmpty>
    ) : filtered ? (
      <DataTableEmpty icon={<SearchXIcon aria-hidden="true" />} title={t("noMatch.title")}>
        <Button prominence="secondary" size="sm" href={siteRoutes.adminOrganizations}>
          {t("noMatch.clear")}
        </Button>
      </DataTableEmpty>
    ) : (
      <DataTableEmpty icon={<Building2Icon aria-hidden="true" />} title={t("empty.title")} />
    );

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <AdminPageHeader
        destination="organizations"
        title={t("title")}
        actions={
          <>
            <ExportOrganizations
              filters={adminOrganizationFilters(search)}
              disabled={organizations.total === 0}
            />
            <AdminCreateOrganization />
          </>
        }
      />
      <AdminOrganizationsToolbar countries={organizations.countries} />

      {/* The creation date gives way first where the table is made to fit, so the name keeps its room. */}
      <DataTableRows
        sortKeys={adminOrganizationSortKeys}
        columns={[
          { id: "name", header: t("columns.organization"), layout: { fill: true } },
          { id: "status", header: t("columns.status"), layout: { width: "md" } },
          {
            id: "created",
            header: t("columns.created"),
            layout: { width: "sm", from: "2xl", descFirst: true },
          },
          {
            id: "actions",
            header: <span className="sr-only">{t("columns.actions")}</span>,
            layout: { width: "action" },
          },
        ]}
        rows={rows.map((row) => ({
          id: row.id,
          cells: {
            name: row.organization,
            status: row.status,
            created: row.created,
            actions: <div className="flex items-center justify-end gap-1">{row.actions}</div>,
          },
        }))}
        empty={empty}
      />

      <ListFooter
        count={t(queue ? "claimsOpen" : "count", { count: organizations.total })}
        page={organizations.page}
        pageSize={organizations.pageSize}
        total={organizations.total}
        href={(page) => address(siteRoutes.adminOrganizations, { ...search, page })}
      />
    </div>
  );
}

export { AdminOrganizationsPage };
