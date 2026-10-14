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
import { OrganizationReviewQueue } from "./organization-review-queue";

const address = createSerializer(adminOrganizationsSearch);

/** How each state of the review reads to the operator who decides it. */
const tones = {
  in_review: "warning",
  needs_changes: "warning",
  approved: "success",
  rejected: "destructive",
  suspended: "destructive",
  merged: "neutral",
} as const;

/** The tone of what waits for the operator: a first review, or a claim to own an organization. */
const requestTones = { new: "info", claim: "warning" } as const;

type AdminOrganizationsPageProps = {
  organizations: AdminOrganizationList;
  search: AdminOrganizationsSearch;
};

/**
 * Admin › Organisations: every organization, those waiting for review first. The list arrives
 * already read; search, the filter and paging are the URL. A row that waits carries Review, and a
 * decision made in its dialog opens the next one that waits on the page.
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
    request: organization.request ? (
      <Status appearance="pill" tone={requestTones[organization.request]}>
        {t(`request.${organization.request}`)}
      </Status>
    ) : null,
    status: (
      <Status appearance="pill" tone={tones[reviewState(organization)]}>
        {t(`status.${reviewState(organization)}`)}
      </Status>
    ),
    askedBy: (
      <span className="block truncate text-muted-foreground">
        {organization.askedBy ?? t("request.none")}
      </span>
    ),
    received: (
      <span className="text-muted-foreground">
        {format.dateTime(new Date(organization.requestedAt ?? organization.createdAt), "date")}
      </span>
    ),
    actions: <AdminOrganizationRowActions organization={organization} />,
  }));

  const queue = search.q.trim() === "" && search.status === "in_review" && search.country === null;
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

      {/* Who asked and when give way first where the table is made to fit, so the name keeps its room. */}
      <OrganizationReviewQueue
        waiting={organizations.items
          .filter((organization) => organization.status === "in_review")
          .map(({ id, name, type, country, createdAt }) => ({
            id,
            name,
            type,
            country,
            createdAt,
          }))}
      >
        <DataTableRows
          sortKeys={adminOrganizationSortKeys}
          columns={[
            { id: "name", header: t("columns.organization"), layout: { fill: true } },
            { id: "request", header: t("columns.request"), layout: { width: "md" } },
            { id: "status", header: t("columns.status"), layout: { width: "md" } },
            {
              id: "askedBy",
              header: t("columns.askedBy"),
              layout: { width: "lg", from: "xl" },
            },
            {
              id: "received",
              header: t("columns.received"),
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
              request: row.request ?? (
                <span className="text-muted-foreground">{t("request.none")}</span>
              ),
              status: row.status,
              askedBy: row.askedBy,
              received: row.received,
              actions: <div className="flex items-center justify-end gap-1">{row.actions}</div>,
            },
          }))}
          empty={empty}
        />
      </OrganizationReviewQueue>

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
