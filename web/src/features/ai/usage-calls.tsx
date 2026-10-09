import { ActivityIcon, SearchXIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { DataTable, DataTableEmpty, DataTableFooter } from "@/components/composites/data-table";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AiUsageCallList } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { taskNames, UsageHeader } from "./usage-page";
import { usageCallsAddress, type UsageCallsSearch } from "./usage-search";
import { UsageCallsToolbar } from "./usage-switches";

/**
 * Admin › AI › Usage › Calls: every call to a model or an OCR service in the period, newest first:
 * when, for what, to which model, what it took and what it was about. A failed call says what kind
 * of failure it was. No prompt, no answer and nothing a provider wrote is kept. The filters and the
 * page are the URL.
 */
async function UsageCallsPage({
  calls,
  search,
}: {
  calls: AiUsageCallList;
  search: UsageCallsSearch;
}) {
  const [t, format, taskName] = await Promise.all([
    getTranslations("Admin.aiUsage.calls"),
    getFormatter(),
    taskNames(),
  ]);
  const today = format.dateTime(new Date(), { dateStyle: "short" });

  /** "Today, 09:41:07" for a call of today in Vietnam time, "3 Oct, 14:32:10" before that. */
  function shortTime(at: Date) {
    const time = format.dateTime(at, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    return format.dateTime(at, { dateStyle: "short" }) === today
      ? t("today", { time })
      : t("dayAndTime", { day: format.dateTime(at, { day: "numeric", month: "short" }), time });
  }

  const rows = calls.items.map((call) => {
    const at = new Date(call.occurredAt);
    const subjectKind =
      call.subjectType === "solution_deck" || call.subjectType === "matching_run"
        ? t(`subject.${call.subjectType}`)
        : call.subjectType;
    return {
      key: call.id,
      at: call.occurredAt,
      time: shortTime(at),
      fullTime: format.dateTime(at, { dateStyle: "full", timeStyle: "medium", hourCycle: "h23" }),
      task: taskName(call.task),
      model: call.modelName,
      provider: call.providerName,
      failure:
        call.failure == null ? null : (
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-destructive" />
            <span className="font-medium">{t(`failure.${call.failure}`)}</span>
            {call.errorStatus != null && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {t("status", { status: call.errorStatus })}
              </span>
            )}
          </span>
        ),
      tokens:
        call.inputTokens == null
          ? null
          : t("tokens", {
              input: format.number(call.inputTokens),
              output: format.number(call.outputTokens ?? 0),
            }),
      duration: t("seconds", {
        seconds: format.number(call.durationMs / 1000, { maximumFractionDigits: 1 }),
      }),
      cost:
        call.estimatedCost == null
          ? null
          : format.number(call.estimatedCost, {
              style: "currency",
              currency: "USD",
              minimumFractionDigits: 2,
              maximumFractionDigits: 4,
            }),
      subject:
        call.subjectType === "solution_deck" && call.subjectId ? (
          <TextButton size="sm" href={`${siteRoutes.adminSolutions}/${call.subjectId}`}>
            {subjectKind}
          </TextButton>
        ) : (
          subjectKind
        ),
    };
  });

  const pages = Math.max(1, Math.ceil(calls.total / calls.pageSize));
  const first = (calls.page - 1) * calls.pageSize + 1;
  const pageHref = (number: number) =>
    usageCallsAddress(siteRoutes.adminAiUsageCalls, { ...search, page: number });
  const filtered =
    search.task !== null ||
    search.provider !== null ||
    search.model !== null ||
    search.outcome !== null;
  const empty =
    rows.length > 0 ? null : filtered ? (
      <DataTableEmpty
        icon={<SearchXIcon aria-hidden="true" />}
        title={t("noMatch.title")}
        description={t("noMatch.description")}
      >
        <Button
          prominence="secondary"
          size="sm"
          href={usageCallsAddress(siteRoutes.adminAiUsageCalls, { period: search.period })}
        >
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
  const unknown = <span aria-label={t("unknown")}>—</span>;

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <UsageHeader current="calls" period={search.period} />
      <UsageCallsToolbar
        tasks={calls.tasks.map((task) => ({ value: task, label: taskName(task) }))}
        providers={calls.providers}
        models={calls.models}
      />

      {/* From 768px: a table. The full date and time is behind the short one. */}
      <DataTable className="hidden md:block">
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.time")}</TableHead>
            <TableHead>{t("columns.task")}</TableHead>
            <TableHead>{t("columns.model")}</TableHead>
            <TableHead>{t("columns.tokens")}</TableHead>
            <TableHead>{t("columns.duration")}</TableHead>
            <TableHead>{t("columns.cost")}</TableHead>
            <TableHead>{t("columns.subject")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell>
                <Tooltip>
                  <TooltipTrigger
                    render={<time dateTime={row.at} className="text-muted-foreground" />}
                  >
                    {row.time}
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="start">
                    {row.fullTime}
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>{row.task}</TableCell>
              <TableCell>
                <span className="flex flex-col">
                  <span className="font-medium">{row.model}</span>
                  <span className="text-xs text-muted-foreground">{row.provider}</span>
                </span>
              </TableCell>
              <TableCell>
                <span className="tabular-nums">{row.failure ?? row.tokens ?? unknown}</span>
              </TableCell>
              <TableCell>
                <span className="tabular-nums">{row.duration}</span>
              </TableCell>
              <TableCell>
                <span className="tabular-nums">{row.cost ?? unknown}</span>
              </TableCell>
              <TableCell>{row.subject ?? unknown}</TableCell>
            </TableRow>
          ))}
          {empty && (
            <TableRow>
              <TableCell colSpan={7}>{empty}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </DataTable>

      {/* Below 768px: one stacked row per call, never a table scrolled sideways. */}
      <ul className="overflow-hidden rounded-lg border md:hidden">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-col gap-1.5 border-b p-3 text-sm last:border-b-0">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate font-medium">{row.model}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{row.duration}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {row.task} · {row.provider}
            </div>
            <div className="flex items-center justify-between gap-3 text-xs tabular-nums">
              {row.failure ?? <span>{row.tokens ?? unknown}</span>}
              {row.cost && <span>{row.cost}</span>}
            </div>
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <time dateTime={row.at}>{row.time}</time>
              {row.subject}
            </div>
          </li>
        ))}
        {empty && <li>{empty}</li>}
      </ul>

      <DataTableFooter
        count={
          calls.total === 0
            ? t("count", { count: 0 })
            : t("range", {
                from: format.number(first),
                to: format.number(first + rows.length - 1),
                count: calls.total,
              })
        }
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

export { UsageCallsPage };
