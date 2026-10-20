import {
  BoxesIcon,
  BuildingIcon,
  LightbulbIcon,
  RocketIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { TextButton } from "@/components/actions/text-button";
import { ChartFrame } from "@/components/composites/chart-frame";
import { Sparkline } from "@/components/composites/sparkline";
import { StatCell, StatStrip } from "@/components/composites/stat-cell";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { Progress } from "@/components/ui/progress";
import { UsageChart } from "@/features/ai/usage-chart";
import { usageOverviewAddress } from "@/features/ai/usage-search";
import { applyFormatter } from "@/features/apply/apply-format";
import { vietnamDay } from "@/features/program/program-format";
import { getFormatter } from "@/i18n/format-server";
import { Link } from "@/i18n/navigation";
import type {
  AiUsageOverview,
  EmailCounts,
  ReviewProgram,
  SearchIndex,
  TalentReviewQueue,
} from "@/lib/api/generated";
import { reviewProgramRoute, siteRoutes } from "@/lib/site";

/** What every module answers of its review queue: now, the oldest, and the last 14 days. */
type ReviewQueue = TalentReviewQueue;

type AdminHomePageProps = {
  /** The review queue of each kind of record GenAI Fund decides on. */
  queues: {
    useCases: ReviewQueue;
    solutions: ReviewQueue;
    talent: ReviewQueue;
    organizations: ReviewQueue;
    deployments: ReviewQueue;
  };
  /** Every program with a submitted application, as the operator reviews it. */
  programs: ReviewProgram[];
  /** The AI calls of the last 7 days. */
  usage: AiUsageOverview;
  /** The email of the last 7 days. */
  email: EmailCounts;
  index: SearchIndex;
};

/** Whole days since an instant, at the time of the request: the page is drawn once per request. */
function daysSince(at: string) {
  return Math.max(0, Math.floor((Date.now() - Date.parse(at)) / 86_400_000));
}

/**
 * Admin home: what waits for a decision, which programs have applications to read, and whether the
 * system is well (docs/increments/completed/bey-175-admin-home). Every block is a way to the page
 * behind it. Nothing here moves but the chart as it draws: the page is opened many times a day.
 */
async function AdminHomePage({ queues, programs, usage, email, index }: AdminHomePageProps) {
  const [t, review, aiUsage, format, locale] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("Review.programs"),
    getTranslations("Admin.aiUsage"),
    getFormatter(),
    getLocale(),
  ]);
  const dates = applyFormatter(locale);
  const count = (value: number) => format.number(value);
  // "7–20 Oct": the first and the last of the days a queue's line covers, in Vietnam.
  const trendRange = (first: string, length: number) => {
    const start = vietnamDay(first);
    const end = new Date(start.getTime() + (length - 1) * 86_400_000);
    return format.dateTimeRange(start, end, { day: "numeric", month: "short" });
  };

  const cells: { key: keyof typeof queues; Icon: LucideIcon; href: string }[] = [
    { key: "useCases", Icon: LightbulbIcon, href: `${siteRoutes.adminUseCases}?status=in_review` },
    { key: "solutions", Icon: BoxesIcon, href: `${siteRoutes.adminSolutions}?status=in_review` },
    { key: "talent", Icon: UsersIcon, href: `${siteRoutes.adminTalent}?status=in_review` },
    {
      key: "organizations",
      Icon: BuildingIcon,
      href: `${siteRoutes.adminOrganizations}?status=in_review`,
    },
    // A deployment is reviewed on its solution: the list keeps the solutions holding one.
    {
      key: "deployments",
      Icon: RocketIcon,
      href: `${siteRoutes.adminSolutions}?deployments=to_review`,
    },
  ];
  const total = cells.reduce((sum, cell) => sum + queues[cell.key].waiting, 0);

  // Once the outcomes are out there is nothing left to read.
  const open = programs.filter((program) => !program.released);

  const { totals, series } = usage;
  const chart = series.map((bucket) => ({
    label: format.dateTime(new Date(bucket.start), "day"),
    succeeded: bucket.succeeded,
    failed: bucket.failed,
  }));

  const listed = index.kinds.reduce((sum, kind) => sum + kind.listed, 0);
  const behind = index.kinds.reduce((sum, kind) => sum + kind.waiting, 0);
  const heldBack = index.kinds.reduce((sum, kind) => sum + kind.heldBack, 0);

  return (
    <div className="flex flex-1 flex-col gap-8 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <AdminPageHeader
        destination="home"
        title={t("title")}
        lead={t("home.lead", { count: total })}
      />

      <StatStrip columns={5} aria-label={t("home.queues")}>
        {cells.map(({ key, Icon, href }, position) => {
          const { waiting, oldestSince, days, from } = queues[key];
          return (
            <StatCell
              key={key}
              label={t(`home.${key}`)}
              value={count(waiting)}
              href={href}
              // The destination's icon in the sidebar, so the cell and the menu read as one place.
              icon={<Icon aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />}
              quiet={waiting === 0}
              wide={position === cells.length - 1}
              aside={
                // The days the line covers are written under it: it has no axis and no tooltip.
                <span className="hidden flex-col items-end gap-1 md:flex">
                  <Sparkline values={days} quiet={days.every((day) => day === 0)} />
                  <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                    {trendRange(from, days.length)}
                  </span>
                </span>
              }
            >
              {waiting > 0 && oldestSince
                ? t("home.oldest", { days: daysSince(oldestSince) })
                : t("home.none")}
            </StatCell>
          );
        })}
      </StatStrip>

      <section aria-labelledby="home-applications" className="flex flex-col gap-3">
        <h2 id="home-applications" className="text-base font-medium">
          {t("home.applications.title")}
        </h2>
        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("home.applications.empty")}</p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-lg border">
            {open.map((program) => (
              <li key={program.id}>
                <Link
                  href={reviewProgramRoute(program.id)}
                  className="flex flex-col gap-3 p-4 transition-colors duration-fast outline-none hover:bg-muted focus-visible:bg-muted md:flex-row md:items-center md:gap-6"
                >
                  <span className="flex flex-1 flex-col gap-0.5">
                    <span className="text-sm font-medium">{program.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {review("closes", { closes: dates.deadline(program.closesAt) })}
                    </span>
                  </span>
                  <span className="flex items-center gap-3 md:w-96">
                    <Progress
                      value={
                        program.applications === 0
                          ? 0
                          : Math.round((program.assessed / program.applications) * 100)
                      }
                      aria-label={t("home.applications.progress", { name: program.name })}
                      className="flex-1"
                    />
                    <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                      {t("home.applications.assessed", {
                        assessed: program.assessed,
                        count: program.applications,
                      })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="home-system" className="flex flex-col gap-3">
        <h2 id="home-system" className="text-base font-medium">
          {t("home.system.title")}
        </h2>
        <div className="grid gap-6 lg:grid-cols-3">
          <ChartFrame
            className="lg:col-span-2"
            title={t("home.system.ai.title")}
            lead={
              totals.calls === 0
                ? t("home.system.ai.none")
                : t("home.system.ai.lead", {
                    calls: totals.calls,
                    rate: format.number(totals.failed / totals.calls, {
                      style: "percent",
                      maximumFractionDigits: 1,
                    }),
                  })
            }
            action={
              <TextButton
                size="sm"
                href={usageOverviewAddress(siteRoutes.adminAiUsage, { period: "7d" })}
              >
                {t("home.system.ai.more")}
              </TextButton>
            }
          >
            {totals.calls > 0 && (
              <UsageChart
                size="compact"
                data={chart}
                name={aiUsage("chart.name", { step: "day", period: "week" })}
                labels={{
                  succeeded: aiUsage("chart.succeeded"),
                  failed: aiUsage("chart.failed"),
                  calls: aiUsage("totals.calls"),
                }}
              />
            )}
          </ChartFrame>

          <StatStrip columns={2} className="lg:grid-rows-2" aria-label={t("home.system.title")}>
            <StatCell
              label={t("home.system.email.label")}
              value={count(email.total)}
              href={siteRoutes.adminEmailActivity}
              quiet={email.total === 0}
            >
              {email.total === 0
                ? t("home.system.email.none")
                : t("home.system.email.note", {
                    delivered: email.delivered,
                    bounced: email.bounced,
                  })}
            </StatCell>
            <StatCell
              label={t("home.system.search.label")}
              value={count(listed)}
              href={siteRoutes.adminSearchIndex}
            >
              {behind + heldBack === 0
                ? t("home.system.search.upToDate")
                : t("home.system.search.behind", { waiting: behind, heldBack })}
            </StatCell>
          </StatStrip>
        </div>
      </section>
    </div>
  );
}

export { AdminHomePage };
