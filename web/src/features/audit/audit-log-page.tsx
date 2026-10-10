import { ScrollTextIcon, SearchXIcon, ServerCogIcon } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { createSerializer } from "nuqs/server";

import { Button } from "@/components/actions/button";
import { DataTable, DataTableEmpty, DataTablePager } from "@/components/composites/data-table";
import { Person } from "@/components/composites/person";
import { AdminPageTitle } from "@/components/layout/admin-icons";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AuditEvent, AuditEventList } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { auditLogSearch, type AuditLogSearch } from "./audit-log-search";
import { AuditLogToolbar } from "./audit-log-toolbar";

const address = createSerializer(auditLogSearch);

type AuditLogPageProps = {
  events: AuditEventList;
  search: AuditLogSearch;
};

/**
 * Admin › Audit log: what operators and the server configuration changed, newest first. A row is
 * the whole event: when, who, and what was done to whom. The list arrives already read; search,
 * filters and the page are the URL.
 */
async function AuditLogPage({ events, search }: AuditLogPageProps) {
  const [t, format, locale] = await Promise.all([
    getTranslations("Admin.auditLog"),
    getFormatter(),
    getLocale(),
  ]);
  const today = format.dateTime(new Date(), { dateStyle: "short" });

  /** "Today, 09:41:07" for an event of today in Vietnam time, "3 Oct 2026, 14:32:07" before that. */
  function exactTime(at: Date) {
    const time = format.dateTime(at, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    return format.dateTime(at, { dateStyle: "short" }) === today
      ? t("today", { time })
      : t("dayAndTime", {
          day: format.dateTime(at, { day: "numeric", month: "short", year: "numeric" }),
          time,
        });
  }

  /** The sentence of an action, ending in what it was done to. */
  function activity(event: AuditEvent) {
    const resource = <span className="font-medium">{event.resource.label}</span>;
    return t.rich(`activity.${event.action}`, { resource: () => resource });
  }

  const rows = events.items.map((event) => {
    const at = new Date(event.occurredAt);
    return {
      id: event.id,
      at: event.occurredAt,
      time: exactTime(at),
      person: event.actor ? (
        <Person name={event.actor.label} email={event.actor.email} />
      ) : (
        // The server configuration made the change, as when a configured address becomes an operator.
        <Person
          name={t("system.name")}
          email={t("system.detail")}
          icon={<ServerCogIcon aria-hidden="true" className="size-4" />}
        />
      ),
      activity: <span data-slot="audit-activity">{activity(event)}</span>,
    };
  });

  /** The address of the page beside this one, with the search and filters kept. */
  const pageHref = (cursor: { before: string } | { after: string }) =>
    address(siteRoutes.adminAuditLog, { ...search, before: null, after: null, ...cursor });
  const filtered = search.q.trim() !== "" || search.action !== null;
  const empty =
    rows.length > 0 ? null : filtered ? (
      <DataTableEmpty
        icon={<SearchXIcon aria-hidden="true" />}
        title={t("noMatch.title")}
        description={t("noMatch.description", { period: search.period })}
      >
        <Button prominence="secondary" size="sm" href={siteRoutes.adminAuditLog}>
          {t("noMatch.clear")}
        </Button>
      </DataTableEmpty>
    ) : (
      <DataTableEmpty
        icon={<ScrollTextIcon aria-hidden="true" />}
        title={t("empty.title", { period: search.period })}
      >
        {search.period !== "all" && (
          <Button
            prominence="secondary"
            size="sm"
            href={address(siteRoutes.adminAuditLog, { period: "all" })}
          >
            {t("empty.showAll")}
          </Button>
        )}
      </DataTableEmpty>
    );

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <AdminPageTitle destination="auditLog">{t("title")}</AdminPageTitle>
      <AuditLogToolbar />

      {/* From 768px: a table. The time is exact to the second, with its year, on every width. */}
      <DataTable className="hidden md:block">
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.time")}</TableHead>
            <TableHead>{t("columns.person")}</TableHead>
            <TableHead>{t("columns.activity")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <time dateTime={row.at} className="text-muted-foreground">
                  {row.time}
                </time>
              </TableCell>
              <TableCell>{row.person}</TableCell>
              <TableCell>{row.activity}</TableCell>
            </TableRow>
          ))}
          {empty && (
            <TableRow>
              <TableCell colSpan={3}>{empty}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </DataTable>

      {/* Below 768px: one stacked row per event, never a table scrolled sideways. */}
      <ul className="overflow-hidden rounded-lg border md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-2 border-b p-3 last:border-b-0">
            {row.person}
            <div className="flex flex-col gap-0.5 pl-11 text-sm">
              {row.activity}
              <time dateTime={row.at} className="text-xs text-muted-foreground">
                {row.time}
              </time>
            </div>
          </li>
        ))}
        {empty && <li>{empty}</li>}
      </ul>

      <DataTablePager
        previous={events.newer ? pageHref({ after: events.newer }) : undefined}
        next={events.older ? pageHref({ before: events.older }) : undefined}
        labels={{
          navigation: t("pagination.label"),
          previous: t("pagination.previous"),
          next: t("pagination.next"),
          goToPrevious: t("pagination.goToPrevious"),
          goToNext: t("pagination.goToNext"),
        }}
      />
    </div>
  );
}

export { AuditLogPage };
