import { ActivityIcon, SearchXIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { createSerializer } from "nuqs/server";

import { Button } from "@/components/actions/button";
import { DataTableEmpty } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { StatCell, StatStrip } from "@/components/composites/stat-cell";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AppMark } from "@/features/identity/app-mark";
import { getFormatter } from "@/i18n/format-server";
import { Link } from "@/i18n/navigation";
import type { McpCall, McpCallList, PersonConnectedApp } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";
import { cn } from "@/lib/utils";
import { clockText } from "@/i18n/formats";

import { McpActivityToolbar } from "./admin-mcp-activity-toolbar";
import { EveryConnectedApp } from "./admin-mcp-apps";
import { McpAdminHeader, type McpCounts } from "./admin-mcp-pages";
import { mcpActivitySearch, type McpActivitySearch } from "./admin-mcp-search";
import { ListFooter } from "@/components/composites/list-footer";

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
 * tool, the record it read and how it ended, under the period's calls, refusals and failures. What
 * was asked is never kept. Search, filters and the page are the URL.
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
  // Server component: the date is read once per request.
  // oxlint-disable-next-line react/purity
  const today = format.dateTime(new Date(), { dateStyle: "short" });

  /** "Today, 09:41" for a call of today in Vietnam time, "3 Oct, 14:32" before that. */
  function shortTime(at: Date) {
    const time = clockText(format, at);
    return format.dateTime(at, { dateStyle: "short" }) === today
      ? t("today", { time })
      : t("dayAndTime", { day: format.dateTime(at, "day"), time });
  }

  const rows = calls.items.map((call, index) => {
    const at = new Date(call.calledAt);
    return {
      key: `${call.calledAt}-${index}`,
      at: call.calledAt,
      time: shortTime(at),
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
      // The record the call read, named as it was then; a search or a refused call read none.
      read: call.target ? (
        call.target.path ? (
          <Link href={call.target.path} className="hover:underline">
            {call.target.label}
          </Link>
        ) : (
          call.target.label
        )
      ) : (
        <span className="text-muted-foreground">{t("nothingRead")}</span>
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
      {/* A cell lists the calls it counts; the counts keep every outcome, so they stay as one is chosen. */}
      <StatStrip columns={3}>
        {(
          [
            { key: "calls", value: calls.counts.calls, outcome: null },
            { key: "refused", value: calls.counts.refused, outcome: "refused" },
            { key: "failed", value: calls.counts.failed, outcome: "failed" },
          ] as const
        ).map((cell) => (
          <StatCell
            key={cell.key}
            label={t(`counts.${cell.key}`)}
            value={format.number(cell.value)}
            href={address(siteRoutes.adminMcpActivity, {
              ...search,
              outcome: cell.outcome,
              page: 1,
            })}
            quiet={cell.key !== "calls" && cell.value === 0}
          />
        ))}
      </StatStrip>

      <McpActivityToolbar apps={calls.apps} tools={calls.tools} />

      {/* A click on the short time opens the full date and time, to the second. */}
      <DataTableRows
        columns={[
          { id: "time", header: t("columns.time") },
          { id: "person", header: t("columns.person") },
          { id: "app", header: t("columns.app") },
          { id: "tool", header: t("columns.tool") },
          { id: "read", header: t("columns.read") },
          { id: "outcome", header: t("columns.outcome") },
        ]}
        rows={rows.map((row) => ({
          id: row.key,
          cells: {
            time: (
              <Popover>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      className="rounded-sm text-muted-foreground outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  }
                >
                  <time dateTime={row.at}>{row.time}</time>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start">
                  {row.fullTime}
                </PopoverContent>
              </Popover>
            ),
            person: row.person,
            app: row.app,
            tool: row.tool,
            read: row.read,
            outcome: row.outcome,
          },
        }))}
        empty={empty}
      />

      <ListFooter
        count={t("count", { count: calls.total })}
        page={calls.page}
        pageSize={calls.pageSize}
        total={calls.total}
        href={pageHref}
      />
    </div>
  );
}

export { McpActivityPage, McpAppsPage };
