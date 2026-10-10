import { ActivityIcon, SearchXIcon } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { createSerializer } from "nuqs/server";

import { Button } from "@/components/actions/button";
import { DataTable, DataTableEmpty, DataTableFooter } from "@/components/composites/data-table";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AppMark } from "@/features/identity/app-mark";
import type { McpCall, McpCallList, PersonConnectedApp } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";
import { cn } from "@/lib/utils";

import { McpActivityToolbar } from "./admin-mcp-activity-toolbar";
import { EveryConnectedApp } from "./admin-mcp-apps";
import { McpAdminHeader, type McpCounts } from "./admin-mcp-pages";
import { mcpActivitySearch, type McpActivitySearch } from "./admin-mcp-search";

const address = createSerializer(mcpActivitySearch);

const outcomeDot: Record<McpCall["outcome"], string> = {
  ok: "bg-success",
  refused: "bg-destructive",
  failed: "bg-muted-foreground",
};

/** Admin › AI › MCP › Connected apps: every person's connected apps, each with a way to end it. */
async function McpAppsPage({ apps, counts }: { apps: PersonConnectedApp[]; counts: McpCounts }) {
  return (
    <div className="flex flex-1 flex-col gap-8 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <McpAdminHeader current="apps" counts={counts} />
      <EveryConnectedApp apps={apps} />
    </div>
  );
}

/**
 * Admin › AI › MCP › Activity: the calls AI apps made, newest first: when, who, which app, which
 * tool and how it ended. What was asked is never kept. Search, filters and the page are the URL.
 */
async function McpActivityPage({
  calls,
  search,
  counts,
}: {
  calls: McpCallList;
  search: McpActivitySearch;
  counts: McpCounts;
}) {
  const [t, format, locale] = await Promise.all([
    getTranslations("Admin.mcp.activity"),
    getFormatter(),
    getLocale(),
  ]);
  const today = format.dateTime(new Date(), { dateStyle: "short" });

  /** "Today, 09:41" for a call of today in Vietnam time, "3 Oct, 14:32" before that. */
  function shortTime(at: Date) {
    const time = format.dateTime(at, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    return format.dateTime(at, { dateStyle: "short" }) === today
      ? t("today", { time })
      : t("dayAndTime", { day: format.dateTime(at, { day: "numeric", month: "short" }), time });
  }

  const rows = calls.items.map((call, index) => {
    const at = new Date(call.calledAt);
    return {
      key: `${call.calledAt}-${index}`,
      at: call.calledAt,
      time: shortTime(at),
      toolName: call.tool,
      fullTime: format.dateTime(at, { dateStyle: "full", timeStyle: "medium", hourCycle: "h23" }),
      person: call.personName ?? call.personEmail ?? t("goneAccount"),
      app: (
        <span className="flex items-center gap-2">
          <AppMark host={call.appHost} clientId={call.clientId} inline />
          {call.appName}
        </span>
      ),
      tool: (
        <span className="flex flex-col">
          <code className="text-xs">{call.tool}</code>
          <span className="text-xs text-muted-foreground">{t(`server.${call.server}`)}</span>
        </span>
      ),
      outcome: (
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn("size-2 shrink-0 rounded-full", outcomeDot[call.outcome])}
          />
          {t(`outcome.${call.outcome}`)}
        </span>
      ),
    };
  });

  const pages = Math.max(1, Math.ceil(calls.total / calls.pageSize));
  const pageHref = (number: number) =>
    address(siteRoutes.adminMcpActivity, { ...search, page: number });
  const filtered =
    search.q.trim() !== "" ||
    search.app !== null ||
    search.tool !== null ||
    search.outcome !== null;
  const empty =
    rows.length > 0 ? null : filtered ? (
      <DataTableEmpty icon={<SearchXIcon aria-hidden="true" />} title={t("noMatch.title")}>
        <Button prominence="secondary" size="sm" href={siteRoutes.adminMcpActivity}>
          {t("noMatch.clear")}
        </Button>
      </DataTableEmpty>
    ) : (
      <DataTableEmpty
        icon={<ActivityIcon aria-hidden="true" />}
        title={t("empty.title")}
        description={t("empty.description")}
      />
    );

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <McpAdminHeader current="activity" counts={counts} />
      <McpActivityToolbar apps={calls.apps} tools={calls.tools} />

      {/* From 768px: a table. A click on the short time opens the full date and time, to the second. */}
      <DataTable className="hidden md:block">
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.time")}</TableHead>
            <TableHead>{t("columns.person")}</TableHead>
            <TableHead>{t("columns.app")}</TableHead>
            <TableHead>{t("columns.tool")}</TableHead>
            <TableHead>{t("columns.outcome")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell>
                <Popover>
                  <PopoverTrigger
                    render={
                      <button
                        type="button"
                        className="text-muted-foreground outline-none hover:underline focus-visible:underline"
                      />
                    }
                  >
                    <time dateTime={row.at}>{row.time}</time>
                  </PopoverTrigger>
                  <PopoverContent side="bottom" align="start">
                    {row.fullTime}
                  </PopoverContent>
                </Popover>
              </TableCell>
              <TableCell>{row.person}</TableCell>
              <TableCell>{row.app}</TableCell>
              <TableCell>{row.tool}</TableCell>
              <TableCell>{row.outcome}</TableCell>
            </TableRow>
          ))}
          {empty && (
            <TableRow>
              <TableCell colSpan={5}>{empty}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </DataTable>

      {/* Below 768px: one stacked row per call, never a table scrolled sideways. */}
      <ul className="overflow-hidden rounded-lg border md:hidden">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-col gap-1.5 border-b p-3 text-sm last:border-b-0">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate font-medium">{row.person}</span>
              {row.outcome}
            </div>
            <div className="flex items-center justify-between gap-3 text-muted-foreground">
              {row.app}
              <code className="text-xs">{row.toolName}</code>
            </div>
            <time dateTime={row.at} className="text-xs text-muted-foreground">
              {row.time}
            </time>
          </li>
        ))}
        {empty && <li>{empty}</li>}
      </ul>

      <DataTableFooter
        count={t("count", { count: calls.total })}
        page={calls.page}
        pages={pages}
        href={pageHref}
        labels={{
          navigation: t("pagination.label"),
          previous: t("pagination.previous"),
          next: t("pagination.next"),
          goToPrevious: t("pagination.goToPrevious"),
          goToNext: t("pagination.goToNext"),
          page: (number) => t("pagination.page", { page: number }),
        }}
      />
    </div>
  );
}

export { McpActivityPage, McpAppsPage };
