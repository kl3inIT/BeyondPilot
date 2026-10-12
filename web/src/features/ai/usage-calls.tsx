import { ActivityIcon, SearchXIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { DataTableEmpty } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AiUsageCallList } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { taskNames, UsageHeader } from "./usage-page";
import { usageCallsAddress, type UsageCallsSearch } from "./usage-search";
import { UsageCallsToolbar } from "./usage-switches";
import { ListFooter } from "@/components/composites/list-footer";

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
      <DataTableEmpty icon={<SearchXIcon aria-hidden="true" />} title={t("noMatch.title")}>
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

      {/* From 768px: a table. A click on the short time opens the full date and time. */}
      <DataTableRows
        className="hidden md:flex"
        columns={[
          { id: "time", header: t("columns.time") },
          { id: "task", header: t("columns.task") },
          { id: "model", header: t("columns.model") },
          { id: "tokens", header: t("columns.tokens") },
          { id: "duration", header: t("columns.duration") },
          { id: "cost", header: t("columns.cost") },
          { id: "subject", header: t("columns.subject") },
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
            ),
            task: row.task,
            model: (
              <span className="flex flex-col">
                <span className="font-medium">{row.model}</span>
                <span className="text-xs text-muted-foreground">{row.provider}</span>
              </span>
            ),
            tokens: <span className="tabular-nums">{row.failure ?? row.tokens ?? unknown}</span>,
            duration: <span className="tabular-nums">{row.duration}</span>,
            cost: <span className="tabular-nums">{row.cost ?? unknown}</span>,
            subject: row.subject ?? unknown,
          },
        }))}
        empty={empty}
      />

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

      <ListFooter
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
        pageSize={calls.pageSize}
        total={calls.total}
        href={pageHref}
      />
    </div>
  );
}

export { UsageCallsPage };
