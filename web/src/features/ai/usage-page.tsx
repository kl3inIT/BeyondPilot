import { ActivityIcon, ChevronRightIcon, CircleAlertIcon, TriangleAlertIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { DataTable, DataTableEmpty } from "@/components/composites/data-table";
import { AdminPageTitle } from "@/components/layout/admin-icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import type { AiUsageOverview } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";
import { cn } from "@/lib/utils";

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
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <AdminPageTitle destination="aiUsage">{t("title")}</AdminPageTitle>
          <p className="text-sm text-muted-foreground">{t("lead")}</p>
        </div>
        <UsagePeriodSwitch />
      </div>
      <nav aria-label={t("tabs.label")} className="border-b">
        <ul className="flex gap-4 md:gap-6">
          {tabs.map((tab) => (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={tab.key === current ? "page" : undefined}
                className={
                  tab.key === current
                    ? "inline-flex min-h-11 items-center border-b-2 border-foreground text-sm font-medium whitespace-nowrap outline-none focus-visible:underline"
                    : "inline-flex min-h-11 items-center border-b-2 border-transparent text-sm whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:underline"
                }
              >
                {t(`tabs.${tab.key}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** One figure of the totals strip, with what it is above it and what it is made of below. */
function Total({
  label,
  value,
  children,
  warning = false,
  wide = false,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
  warning?: boolean;
  /** The odd tile out fills the row at phone width. */
  wide?: boolean;
}) {
  return (
    <div
      className={cn("flex flex-col gap-1 bg-background p-4", wide && "col-span-2 lg:col-span-1")}
    >
      <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {warning && <TriangleAlertIcon aria-hidden="true" className="size-4 text-warning" />}
        {label}
      </dt>
      <dd className="flex flex-col gap-1">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground">{children}</span>
      </dd>
    </div>
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
  const clock = (at: Date) =>
    format.dateTime(at, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const bucketLabel = (start: string) =>
    byHour
      ? clock(new Date(start))
      : format.dateTime(new Date(start), { day: "numeric", month: "short" });

  const worst = failing[0];
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
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden="true" />
            <AlertTitle>
              {t("failing.title", { task: taskName(worst.task), model: worst.modelName })}
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
              {failing.length > 1 && ` ${t("failing.others", { count: failing.length - 1 })}`}
            </AlertDescription>
          </Alert>
          <Button
            prominence="secondary"
            size="sm"
            href={usageCallsAddress(siteRoutes.adminAiUsageCalls, {
              period: "7d",
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
          <dl
            className={cn(
              "grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border",
              totals.unpricedCalls > 0 ? "lg:grid-cols-5" : "lg:grid-cols-4",
            )}
          >
            <Total label={t("totals.calls")} value={count(totals.calls)}>
              {t("totals.callsOf", {
                succeeded: count(totals.succeeded),
                failed: count(totals.failed),
              })}
            </Total>
            <Total label={t("totals.failureRate")} value={percent(totals.failed, totals.calls)}>
              {t("totals.failureRateOf", {
                failed: count(totals.failed),
                calls: count(totals.calls),
              })}
            </Total>
            <Total
              label={t("totals.tokens")}
              value={tokens(totals.inputTokens + totals.outputTokens)}
            >
              {t("totals.tokensOf", {
                input: tokens(totals.inputTokens),
                output: tokens(totals.outputTokens),
              })}
            </Total>
            <Total
              label={t("totals.cost")}
              value={totals.estimatedCost == null ? "—" : cost(totals.estimatedCost)}
            >
              {t("totals.costOf", { count: totals.pricedCalls })}
            </Total>
            {totals.unpricedCalls > 0 && (
              <Total label={t("totals.unpriced")} value={count(totals.unpricedCalls)} warning wide>
                <TextButton size="sm" href={siteRoutes.adminAiProviders}>
                  {t("totals.prices")}
                </TextButton>
              </Total>
            )}
          </dl>

          <figure className="flex flex-col gap-4 rounded-lg border p-4">
            <figcaption className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">
                {t(byHour ? "chart.byHour" : "chart.byDay")}
              </span>
              {busiest && (
                <span className="text-xs text-muted-foreground">
                  {t(byHour ? "chart.mostAtHour" : "chart.mostOnDay", {
                    when: bucketLabel(busiest.start),
                    count: busiest.succeeded + busiest.failed,
                  })}
                </span>
              )}
            </figcaption>
            <UsageChart
              data={chart}
              labels={{ succeeded: t("chart.succeeded"), failed: t("chart.failed") }}
            />
          </figure>

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

            {/* From 768px: a table. Each name opens the calls of its row in the log. */}
            <DataTable className="hidden md:block">
              <TableHeader>
                <TableRow>
                  <TableHead>{t(`breakdown.by.${overview.by}`)}</TableHead>
                  {overview.by === "model" && <TableHead>{t("breakdown.by.task")}</TableHead>}
                  <TableHead>{t("breakdown.share")}</TableHead>
                  <TableHead>{t("breakdown.calls")}</TableHead>
                  <TableHead>{t("breakdown.failed")}</TableHead>
                  <TableHead>{t("breakdown.failureRate")}</TableHead>
                  <TableHead>{t("breakdown.tokens")}</TableHead>
                  <TableHead>{t("breakdown.time")}</TableHead>
                  <TableHead>{t("breakdown.cost")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>
                      <Link
                        href={row.href}
                        className="flex items-center gap-1 font-medium outline-none hover:underline focus-visible:underline"
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
                    </TableCell>
                    {overview.by === "model" && <TableCell>{row.task}</TableCell>}
                    <TableCell>
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
                    </TableCell>
                    <TableCell>
                      <span className="tabular-nums">{row.calls}</span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={row.failing ? "text-destructive tabular-nums" : "tabular-nums"}
                      >
                        {row.failed}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={row.failing ? "text-destructive tabular-nums" : "tabular-nums"}
                      >
                        {row.failureRate}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="tabular-nums">{row.tokens ?? unknown}</span>
                    </TableCell>
                    <TableCell>
                      <span className="tabular-nums">{row.time}</span>
                    </TableCell>
                    <TableCell>
                      <span className="tabular-nums">{row.cost ?? unknown}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>

            {/* Below 768px: one stacked row per group, never a table scrolled sideways. */}
            <ul className="overflow-hidden rounded-lg border md:hidden">
              {rows.map((row) => (
                <li key={row.key} className="border-b last:border-b-0">
                  <Link
                    href={row.href}
                    className="flex flex-col gap-2 p-3 text-sm outline-none focus-visible:bg-muted"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="flex flex-col">
                        <span className="font-medium">{row.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {[row.under, row.task].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <ChevronRightIcon
                        aria-hidden="true"
                        className="size-4 text-muted-foreground"
                      />
                    </span>
                    <span className="flex items-center gap-2">
                      <Progress
                        value={row.share}
                        aria-label={t("breakdown.shareOf", { name: row.name })}
                        className="flex-1"
                      />
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {format.number(row.share / 100, { style: "percent" })}
                      </span>
                    </span>
                    <span className={row.failing ? "text-xs text-destructive" : "text-xs"}>
                      {t("breakdown.callsLine", {
                        calls: row.calls,
                        failed: row.failed,
                        rate: row.failureRate,
                      })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t("breakdown.timeLine", { time: row.time })}
                      {" · "}
                      {row.cost
                        ? t("breakdown.costLine", { cost: row.cost })
                        : t("breakdown.noPrice")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <p className="text-xs text-muted-foreground">{t("estimate")}</p>
        </>
      )}
    </div>
  );
}

export { taskNames, UsageHeader, UsageOverviewPage };
