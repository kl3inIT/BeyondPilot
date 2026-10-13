import {
  ActivityIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  InfoIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { ChartFrame } from "@/components/composites/chart-frame";
import { CountingNumber } from "@/components/composites/counting-number";
import { DataTableEmpty } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { StatCell, StatStrip } from "@/components/composites/stat-cell";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { getFormatter } from "@/i18n/format-server";
import { Link } from "@/i18n/navigation";
import type { AiUsageOverview } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { UsageChart } from "./usage-chart";
import {
  usageCallsAddress,
  usageOverviewAddress,
  type UsageOverviewSearch,
  type UsagePeriod,
} from "./usage-search";
import { UsageGroupingSwitch, UsagePeriodSwitch } from "./usage-switches";

/** The name an operator reads for what a call was made for; a task this screen does not know keeps its own. */
async function taskNames() {
  const t = await getTranslations("Admin.aiUsage.task");
  return (task: string) =>
    task === "matching" || task === "document_reading" || task === "model_test" ? t(task) : task;
}

/** The head of Admin › AI › Usage: its title, the period it covers and its two tabs, which keep the period. */
async function UsageHeader({
  current,
  period,
}: {
  current: "overview" | "calls";
  period: UsagePeriod;
}) {
  const t = await getTranslations("Admin.aiUsage");
  const tabs = [
    { key: "overview", href: usageOverviewAddress(siteRoutes.adminAiUsage, { period }) },
    { key: "calls", href: usageCallsAddress(siteRoutes.adminAiUsageCalls, { period }) },
  ] as const;

  return (
    <AdminPageHeader destination="aiUsage" title={t("title")} actions={<UsagePeriodSwitch />}>
      <nav aria-label={t("tabs.label")} className="border-b">
        <ul className="flex gap-4 md:gap-6">
          {tabs.map((tab) => (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={tab.key === current ? "page" : undefined}
                className={
                  tab.key === current
                    ? "inline-flex min-h-11 items-center border-b-2 border-foreground text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                    : "inline-flex min-h-11 items-center border-b-2 border-transparent text-sm whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                }
              >
                {t(`tabs.${tab.key}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </AdminPageHeader>
  );
}

/**
 * Admin › AI › Usage › Overview: what is failing now, what the calls of the period came to, the
 * calls over time, and where they went. Costs are estimates; a call without a known price is
 * counted apart and never as free.
 */
async function UsageOverviewPage({
  overview,
  search,
}: {
  overview: AiUsageOverview;
  search: UsageOverviewSearch;
}) {
  const [t, format, taskName] = await Promise.all([
    getTranslations("Admin.aiUsage"),
    getFormatter(),
    taskNames(),
  ]);
  const { totals, failing, series, breakdown } = overview;
  const byHour = overview.seriesStep === "hour";

  const count = (value: number) => format.number(value);
  const tokens = (value: number) =>
    format.number(value, { notation: "compact", maximumFractionDigits: 2 });
  const cost = (value: number) =>
    format.number(value, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: value < 1 ? 4 : 2,
    });
  const percent = (part: number, whole: number) =>
    format.number(whole === 0 ? 0 : part / whole, { style: "percent", maximumFractionDigits: 1 });
  const seconds = (milliseconds: number) =>
    t("seconds", { seconds: format.number(milliseconds / 1000, { maximumFractionDigits: 1 }) });
  const clock = (at: Date) => format.dateTime(at, "time");
  const bucketLabel = (start: string) =>
    byHour ? clock(new Date(start)) : format.dateTime(new Date(start), "day");

  // What a task still runs on comes first: failures of what it used before are no longer an alarm.
  const worst = failing.find((item) => item.assigned) ?? failing[0];
  const alsoFailing = failing.filter((item) => item.assigned && item !== worst).length;
  const busiest = series.reduce<(typeof series)[number] | null>(
    (most, bucket) =>
      bucket.succeeded + bucket.failed > (most ? most.succeeded + most.failed : 0) ? bucket : most,
    null,
  );
  const chart = series.map((bucket) => ({
    label: bucketLabel(bucket.start),
    succeeded: bucket.succeeded,
    failed: bucket.failed,
  }));

  const rows = breakdown.map((group) => {
    const name = group.modelName ?? (group.task ? taskName(group.task) : group.providerName) ?? "";
    return {
      key: `${group.modelName}-${group.providerName}-${group.task}`,
      name,
      under: group.modelName ? group.providerName : null,
      task: group.modelName && group.task ? taskName(group.task) : null,
      share: totals.calls === 0 ? 0 : Math.round((group.calls / totals.calls) * 100),
      calls: count(group.calls),
      failed: count(group.failed),
      failing: group.failed > 0 && group.failed * 10 >= group.calls,
      failureRate: percent(group.failed, group.calls),
      tokens:
        group.inputTokens + group.outputTokens > 0
          ? tokens(group.inputTokens + group.outputTokens)
          : null,
      time: seconds(group.averageDurationMs),
      cost: group.estimatedCost == null ? null : cost(group.estimatedCost),
      href: usageCallsAddress(siteRoutes.adminAiUsageCalls, {
        period: search.period,
        model: group.modelName ?? null,
        provider: group.providerName ?? null,
        task: group.task ?? null,
      }),
    };
  });
  const unknown = <span aria-label={t("unknown")}>—</span>;

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <UsageHeader current="overview" period={search.period} />

      {worst && (
        <div className="flex flex-col items-start gap-3">
          <Alert variant={worst.assigned ? "destructive" : "default"}>
            {worst.assigned ? (
              <CircleAlertIcon aria-hidden="true" />
            ) : (
              <InfoIcon aria-hidden="true" />
            )}
            <AlertTitle>
              {t(worst.assigned ? "failing.title" : "failing.replacedTitle", {
                task: taskName(worst.task),
                model: worst.modelName,
              })}
            </AlertTitle>
            <AlertDescription>
              {t("failing.description", {
                failed: worst.failed,
                calls: worst.calls,
                time: format.dateTime(new Date(worst.lastFailedAt), {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                  hourCycle: "h23",
                }),
                provider: worst.providerName,
              })}{" "}
              {t(`failing.kind.${worst.lastFailure}`)}
              {alsoFailing > 0 && ` ${t("failing.others", { count: alsoFailing })}`}
            </AlertDescription>
          </Alert>
          <Button
            prominence="secondary"
            size="sm"
            href={usageCallsAddress(siteRoutes.adminAiUsageCalls, {
              period: search.period,
              task: worst.task,
              model: worst.modelName,
              outcome: "failed",
            })}
          >
            {t("failing.see")}
          </Button>
        </div>
      )}

      {totals.calls === 0 ? (
        <div className="rounded-lg border border-dashed">
          <DataTableEmpty
            icon={<ActivityIcon aria-hidden="true" />}
            title={t(`empty.title.${search.period}`)}
            description={t("empty.description")}
          />
        </div>
      ) : (
        <>
          <StatStrip columns={totals.unpricedCalls > 0 ? 5 : 4}>
            <StatCell label={t("totals.calls")} value={<CountingNumber value={totals.calls} />}>
              {t("totals.callsOf", {
                succeeded: count(totals.succeeded),
                failed: count(totals.failed),
              })}
            </StatCell>
            <StatCell
              label={t("totals.failureRate")}
              value={
                <CountingNumber
                  value={totals.calls === 0 ? 0 : totals.failed / totals.calls}
                  format={{ style: "percent", maximumFractionDigits: 1 }}
                />
              }
            >
              {t("totals.failureRateOf", {
                failed: count(totals.failed),
                calls: count(totals.calls),
              })}
            </StatCell>
            <StatCell
              label={t("totals.tokens")}
              value={
                <CountingNumber
                  value={totals.inputTokens + totals.outputTokens}
                  format={{ notation: "compact", maximumFractionDigits: 2 }}
                />
              }
            >
              {t("totals.tokensOf", {
                input: tokens(totals.inputTokens),
                output: tokens(totals.outputTokens),
              })}
            </StatCell>
            <StatCell
              label={t("totals.cost")}
              value={
                totals.estimatedCost == null ? (
                  "—"
                ) : (
                  <CountingNumber
                    value={totals.estimatedCost}
                    format={{
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 2,
                      maximumFractionDigits: totals.estimatedCost < 1 ? 4 : 2,
                    }}
                  />
                )
              }
            >
              {t("totals.costOf", { count: totals.pricedCalls })}
            </StatCell>
            {totals.unpricedCalls > 0 && (
              <StatCell
                label={t("totals.unpriced")}
                value={<CountingNumber value={totals.unpricedCalls} />}
                icon={<TriangleAlertIcon aria-hidden="true" className="size-4 text-warning" />}
                wide
              >
                <TextButton size="sm" href={siteRoutes.adminAiProviders}>
                  {t("totals.prices")}
                </TextButton>
              </StatCell>
            )}
          </StatStrip>

          <ChartFrame
            title={t(byHour ? "chart.byHour" : "chart.byDay")}
            lead={
              busiest &&
              t(byHour ? "chart.mostAtHour" : "chart.mostOnDay", {
                when: bucketLabel(busiest.start),
                count: busiest.succeeded + busiest.failed,
              })
            }
          >
            <UsageChart
              data={chart}
              name={t("chart.name", {
                step: byHour ? "hour" : "day",
                period: { today: "today", "7d": "week", "30d": "month" }[search.period],
              })}
              labels={{
                succeeded: t("chart.succeeded"),
                failed: t("chart.failed"),
                calls: t("totals.calls"),
              }}
            />
          </ChartFrame>

          <section aria-labelledby="usage-breakdown" className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-col gap-1">
                <h2 id="usage-breakdown" className="text-base font-medium">
                  {t("breakdown.title")}
                </h2>
                <p className="text-sm text-muted-foreground">{t("breakdown.lead")}</p>
              </div>
              <UsageGroupingSwitch />
            </div>

            {/* Each name opens the calls of its row in the log. */}
            <DataTableRows
              columns={[
                { id: "name", header: t(`breakdown.by.${overview.by}`) },
                ...(overview.by === "model"
                  ? [{ id: "task", header: t("breakdown.by.task") }]
                  : []),
                { id: "share", header: t("breakdown.share") },
                { id: "calls", header: t("breakdown.calls") },
                { id: "failed", header: t("breakdown.failed") },
                { id: "failureRate", header: t("breakdown.failureRate") },
                { id: "tokens", header: t("breakdown.tokens") },
                { id: "time", header: t("breakdown.time") },
                { id: "cost", header: t("breakdown.cost") },
              ]}
              rows={rows.map((row) => ({
                id: row.key,
                cells: {
                  name: (
                    <Link
                      href={row.href}
                      className="flex items-center gap-1 rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="flex flex-col">
                        {row.name}
                        {row.under && (
                          <span className="text-xs font-normal text-muted-foreground">
                            {row.under}
                          </span>
                        )}
                      </span>
                      <ChevronRightIcon
                        aria-hidden="true"
                        className="size-4 text-muted-foreground"
                      />
                    </Link>
                  ),
                  task: row.task,
                  share: (
                    <div className="flex items-center gap-2">
                      <Progress
                        value={row.share}
                        aria-label={t("breakdown.shareOf", { name: row.name })}
                        className="w-28"
                      />
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {format.number(row.share / 100, { style: "percent" })}
                      </span>
                    </div>
                  ),
                  calls: <span className="tabular-nums">{row.calls}</span>,
                  failed: (
                    <span
                      className={row.failing ? "text-destructive tabular-nums" : "tabular-nums"}
                    >
                      {row.failed}
                    </span>
                  ),
                  failureRate: (
                    <span
                      className={row.failing ? "text-destructive tabular-nums" : "tabular-nums"}
                    >
                      {row.failureRate}
                    </span>
                  ),
                  tokens: <span className="tabular-nums">{row.tokens ?? unknown}</span>,
                  time: <span className="tabular-nums">{row.time}</span>,
                  cost: <span className="tabular-nums">{row.cost ?? unknown}</span>,
                },
              }))}
            />
          </section>

          <p className="text-xs text-muted-foreground">{t("estimate")}</p>
        </>
      )}
    </div>
  );
}

export { taskNames, UsageHeader, UsageOverviewPage };
