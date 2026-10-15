import { getTranslations } from "next-intl/server";

import { TextButton } from "@/components/actions/text-button";
import { DataTableRows } from "@/components/composites/data-table-view";
import { StatCell, StatStrip } from "@/components/composites/stat-cell";
import { Status } from "@/components/composites/status";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { usageNumbers } from "@/features/ai/usage-format";
import { getFormatter } from "@/i18n/format-server";
import type { MatchingRunDetail, MatchingRunMove } from "@/lib/api/generated";
import { adminAiMatchingRunRoute, adminUseCaseCandidatesRoute, siteRoutes } from "@/lib/site";

import { took, tones } from "./matching-runs-page";

/**
 * One run of matching for operators: what it cost and how long it took, what each step did, and
 * which solutions changed group since the run of the same use case before it. The comparison needs
 * both runs to have kept their groups, which runs do from 16 October 2026.
 */
async function MatchingRunPage({ detail }: { detail: MatchingRunDetail }) {
  const [t, word, format] = await Promise.all([
    getTranslations("Admin.matching.runs"),
    getTranslations("Matching"),
    getFormatter(),
  ]);
  const numbers = usageNumbers(format);
  const { run } = detail;
  const duration = took(run);
  const group = (bucket: MatchingRunMove["before"]) =>
    bucket == null ? null : bucket === "none" ? t("groupNone") : word(`groups.${bucket}.title`);
  const why = detail.previousRunId == null ? t("changes.first") : t("changes.notKept");

  return (
    <div className="flex flex-1 flex-col gap-8 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <AdminPageHeader
        back={{ href: siteRoutes.adminAiMatchingRuns, label: t("back") }}
        title={run.useCaseTitle ?? "—"}
        badges={<Status tone={tones[run.state]}>{t(`state.${run.state}`)}</Status>}
        lead={t("detailLead", {
          date: format.dateTime(new Date(run.createdAt), {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Ho_Chi_Minh",
          }),
          model: run.modelName ?? t("noModel"),
          version: run.promptVersion,
        })}
        actions={
          run.useCaseTitle ? (
            <TextButton href={adminUseCaseCandidatesRoute(run.useCaseId)}>
              {word("pageTabs.candidates")}
            </TextButton>
          ) : undefined
        }
      />

      {run.failure && (
        <p className="text-sm text-destructive">{t("failure", { failure: run.failure })}</p>
      )}

      <StatStrip columns={5}>
        <StatCell
          label={t("stats.cost")}
          value={run.cost == null ? t("stats.costNone") : numbers.cost(run.cost)}
        >
          {run.unpricedCalls > 0 ? t("unpriced", { count: run.unpricedCalls }) : null}
        </StatCell>
        <StatCell label={t("stats.calls")} value={format.number(run.calls)}>
          {t("stats.callsFailed", { count: run.failedCalls })}
        </StatCell>
        <StatCell label={t("stats.input")} value={numbers.tokens(run.inputTokens)}>
          {t("stats.inputCache", {
            read: numbers.tokens(run.cacheReadTokens),
            written: numbers.tokens(run.cacheWriteTokens),
          })}
        </StatCell>
        <StatCell label={t("stats.output")} value={numbers.tokens(run.outputTokens)} />
        <StatCell
          label={t("stats.time")}
          value={
            duration == null
              ? t("stats.timeNone")
              : t("seconds", { seconds: numbers.seconds(duration) })
          }
        >
          {run.judged != null && run.kept != null
            ? t("judged", { judged: run.judged, kept: run.kept })
            : null}
        </StatCell>
      </StatStrip>

      <section aria-labelledby="run-steps" className="flex flex-col gap-3">
        <h2 id="run-steps" className="text-base font-semibold">
          {t("steps.title")}
        </h2>
        {detail.steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("steps.none")}</p>
        ) : (
          <DataTableRows
            columns={[
              { id: "step", header: t("steps.columns.step"), layout: { fill: true } },
              { id: "count", header: t("steps.columns.count"), layout: { numeric: true } },
              { id: "calls", header: t("steps.columns.calls"), layout: { numeric: true } },
              { id: "tokens", header: t("steps.columns.tokens"), layout: { numeric: true } },
              { id: "time", header: t("steps.columns.time"), layout: { numeric: true } },
            ]}
            rows={detail.steps.map((step) => ({
              id: step.name,
              cells: {
                step: t(`steps.${step.name}`),
                count: `${format.number(step.takenIn)} → ${format.number(step.givenOut)}`,
                calls: format.number(step.calls),
                tokens: `${numbers.tokens(step.inputTokens)} / ${numbers.tokens(step.outputTokens)}`,
                time: t("seconds", { seconds: numbers.seconds(step.millis) }),
              },
            }))}
          />
        )}
      </section>

      <section aria-labelledby="run-changes" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="run-changes" className="text-base font-semibold">
            {t("changes.title")}
          </h2>
          {detail.previousRunId && (
            <TextButton size="sm" href={adminAiMatchingRunRoute(detail.previousRunId)}>
              {t("changes.previous")}
            </TextButton>
          )}
        </div>
        {!detail.compared ? (
          <p className="text-sm text-muted-foreground">
            {run.judged == null && detail.previousRunId != null ? t("changes.noneKept") : why}
          </p>
        ) : (
          <>
            <StatStrip columns={4} aria-label={t("changes.groupsLabel")}>
              {detail.groups.map((one) => (
                <StatCell
                  key={one.bucket}
                  label={group(one.bucket) ?? ""}
                  value={
                    <span className="flex items-baseline gap-2">
                      <span className="sr-only">{t("changes.before")}</span>
                      <span className="text-muted-foreground">{format.number(one.before)}</span>
                      <span aria-hidden="true" className="text-base text-muted-foreground">
                        →
                      </span>
                      <span className="sr-only">{t("changes.now")}</span>
                      {format.number(one.after)}
                    </span>
                  }
                />
              ))}
            </StatStrip>
            <p className="text-sm">{t("changes.moved", { count: detail.moves.length })}</p>
            {detail.moves.length > 0 && (
              <DataTableRows
                columns={[
                  { id: "solution", header: t("changes.columns.solution"), layout: { fill: true } },
                  { id: "before", header: t("changes.columns.before") },
                  { id: "now", header: t("changes.columns.now") },
                ]}
                rows={detail.moves.map((move) => ({
                  id: move.solutionId,
                  cells: {
                    solution: move.solutionName ?? t("changes.unnamed"),
                    before: group(move.before) ?? (
                      <span className="text-muted-foreground">{t("changes.entered")}</span>
                    ),
                    now: group(move.after) ?? (
                      <span className="text-muted-foreground">{t("changes.left")}</span>
                    ),
                  },
                }))}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}

export { MatchingRunPage };
