import { getTranslations } from "next-intl/server";

import { TextButton } from "@/components/actions/text-button";
import { DataTableRows } from "@/components/composites/data-table-view";
import { ListFooter } from "@/components/composites/list-footer";
import { Status } from "@/components/composites/status";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { usageNumbers } from "@/features/ai/usage-format";
import { getFormatter } from "@/i18n/format-server";
import type { MatchingRunList, MatchingRunSummary } from "@/lib/api/generated";
import { adminAiMatchingRunRoute, siteRoutes } from "@/lib/site";

import { MatchingAdminTabs } from "./matching-admin-tabs";
import { matchingRunsAddress } from "./matching-search";

/** The tone of a run's state: what ended well, what is at work, what waits and what failed. */
const tones = {
  done: "success",
  running: "info",
  queued: "neutral",
  waiting: "warning",
  failed: "destructive",
} as const satisfies Record<MatchingRunSummary["state"], string>;

/** How long a run took, in milliseconds; null while it has not ended. */
function took(run: MatchingRunSummary) {
  return run.startedAt && run.endedAt
    ? new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime()
    : null;
}

/**
 * Admin › AI › Matching, the Runs tab: every run of every use case, the newest first, with who
 * started it, how it ended, how many solutions it read or kept, the tokens and what it cost. A row
 * opens the run. The page of the list is the URL.
 */
async function MatchingRunsPage({ runs, size }: { runs: MatchingRunList; size: number | null }) {
  const [t, title, format] = await Promise.all([
    getTranslations("Admin.matching.runs"),
    getTranslations("Admin.matching"),
    getFormatter(),
  ]);
  const numbers = usageNumbers(format);
  const when = (at: string) =>
    format.dateTime(new Date(at), {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Ho_Chi_Minh",
    });

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <AdminPageHeader
        destination="aiMatching"
        title={title("title")}
        lead={runs.total === 0 ? t("empty") : t("lead")}
      >
        <MatchingAdminTabs current="runs" />
      </AdminPageHeader>

      {runs.total > 0 && (
        <>
          <DataTableRows
            columns={[
              { id: "run", header: t("columns.run"), layout: { fill: true } },
              { id: "started", header: t("columns.started"), layout: { from: "xl" } },
              { id: "status", header: t("columns.status"), layout: { nowrap: true } },
              { id: "solutions", header: t("columns.solutions"), layout: { from: "lg" } },
              { id: "tokens", header: t("columns.tokens"), layout: { numeric: true } },
              { id: "time", header: t("columns.time"), layout: { numeric: true, from: "lg" } },
              { id: "cost", header: t("columns.cost"), layout: { numeric: true } },
            ]}
            rows={runs.items.map((run) => {
              const duration = took(run);
              return {
                id: run.id,
                cells: {
                  // The row opens the run through this link.
                  run: (
                    <span className="flex min-w-0 flex-col items-start gap-0.5">
                      <TextButton href={adminAiMatchingRunRoute(run.id)} className="max-w-full">
                        <span className="truncate">{run.useCaseTitle ?? "—"}</span>
                      </TextButton>
                      <time dateTime={run.createdAt} className="text-xs text-muted-foreground">
                        {when(run.createdAt)}
                        {run.modelName ? ` · ${run.modelName}` : ""}
                      </time>
                    </span>
                  ),
                  started: (
                    <span className="flex flex-col">
                      <span>{t(`origin.${run.origin}`)}</span>
                      {run.startedBy && (
                        <span className="text-xs text-muted-foreground">{run.startedBy}</span>
                      )}
                    </span>
                  ),
                  status: <Status tone={tones[run.state]}>{t(`state.${run.state}`)}</Status>,
                  solutions:
                    run.judged == null || run.kept == null ? (
                      <span className="text-muted-foreground">{t("notKept")}</span>
                    ) : (
                      t("judged", { judged: run.judged, kept: run.kept })
                    ),
                  tokens: (
                    <span className="flex flex-col items-end">
                      <span>{numbers.tokens(run.inputTokens)}</span>
                      {run.cacheReadTokens > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {t("cached", { tokens: numbers.tokens(run.cacheReadTokens) })}
                        </span>
                      )}
                    </span>
                  ),
                  time:
                    duration == null ? "—" : t("seconds", { seconds: numbers.seconds(duration) }),
                  cost:
                    run.calls === 0
                      ? numbers.cost(0)
                      : run.cost == null
                        ? "—"
                        : numbers.cost(run.cost),
                },
              };
            })}
          />

          <ListFooter
            count={t("count", { count: runs.total })}
            page={runs.page}
            pageSize={runs.pageSize}
            total={runs.total}
            href={(page) => matchingRunsAddress(siteRoutes.adminAiMatchingRuns, { page, size })}
          />
        </>
      )}
    </div>
  );
}

export { MatchingRunsPage, took, tones };
