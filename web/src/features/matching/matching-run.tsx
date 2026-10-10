"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CircleAlertIcon,
  CircleIcon,
  Loader2Icon,
  PlusIcon,
  RotateCwIcon,
  ScanSearchIcon,
  SparklesIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { LiveRefresh } from "@/features/usecase/live-refresh";
import type { Matching, MatchingStep } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { describeRunFailure } from "./matching-errors";
import { matchesOf, needsOf, runStages, stageOf, stageState, type RunStage } from "./matching-view";

type RunStagesProps = {
  /** The stage the run is at; `done` once it ended. */
  at: RunStage;
  judged: number;
  total: number;
};

/**
 * What a run goes through, by name and in order: the stages behind it are ticked, the one at work
 * turns, and the last one is its end. While solutions are read the stage says how many are done.
 */
function RunStages({ at, judged, total }: RunStagesProps) {
  const t = useTranslations("Matching.run.stages");

  return (
    <ol
      aria-label={t("label")}
      className="flex flex-col gap-x-2 gap-y-1.5 sm:flex-row sm:flex-wrap sm:items-center"
    >
      {runStages.map((stage, index) => {
        const state = stageState(stage, at);
        return (
          <li
            key={stage}
            data-state={state}
            aria-current={state === "current" ? "step" : undefined}
            className="flex items-center gap-2 text-muted-foreground data-[state=current]:font-medium data-[state=current]:text-foreground data-[state=passed]:text-foreground"
          >
            {index > 0 && (
              <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 max-sm:hidden" />
            )}
            {state === "passed" && (
              <CheckIcon aria-hidden="true" className="size-4 shrink-0 text-success" />
            )}
            {state === "current" && (
              <Loader2Icon
                aria-hidden="true"
                className="size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none"
              />
            )}
            {state === "ahead" && <CircleIcon aria-hidden="true" className="size-4 shrink-0" />}
            <span>
              {t(stage)}
              {state === "passed" && <span className="sr-only">{t("passed")}</span>}
            </span>
            {stage === "reading" && state === "current" && total > 0 && (
              <span className="font-normal text-muted-foreground tabular-nums">
                {t("count", { judged, total })}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * What the last run did, behind one quiet line: the stages it went through, each with its number: how
 * many requirements it read in the brief, how many solutions it read closely, and how many of them
 * match. The numbers are those every reader of the page is answered. An operator also reads how long
 * each stage took and which model read the solutions, when the answer holds them.
 */
function RunFound({ matching }: { matching: Matching }) {
  const t = useTranslations("Matching.run.found");
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const { run, steps, requirements, candidates } = matching;

  /** How long a step of the run took, in seconds, or in minutes once it is more than a minute and a half. */
  const took = (name: MatchingStep["name"]) => {
    const step = steps.find((one) => one.name === name);
    if (!step) {
      return undefined;
    }
    const seconds = step.millis / 1000;
    return seconds < 90
      ? format.number(Math.max(1, Math.round(seconds)), { style: "unit", unit: "second" })
      : format.number(seconds / 60, {
          style: "unit",
          unit: "minute",
          maximumFractionDigits: 1,
        });
  };
  const stages = [
    {
      name: "brief",
      text: t("brief", { count: needsOf(requirements).length }),
      more: took("requirements"),
    },
    { name: "search", text: t("search"), more: took("candidates") },
    {
      name: "reading",
      text: t("reading", { total: run?.total ?? 0 }),
      more: [run?.modelName, took("judgment")].filter(Boolean).join(" · "),
    },
    { name: "matches", text: t("matches", { shown: matchesOf(candidates).matches }), more: "" },
  ];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger render={<TextButton size="sm" />}>
        {t("title")}
        {open ? <ChevronUpIcon aria-hidden="true" /> : <ChevronDownIcon aria-hidden="true" />}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol aria-label={t("title")} className="flex flex-col gap-1 pt-2">
          {stages.map((stage) => (
            <li
              key={stage.name}
              data-stage={stage.name}
              className="flex flex-wrap items-baseline gap-x-2"
            >
              {stage.text}
              {stage.more && (
                <span className="text-xs text-muted-foreground tabular-nums">{stage.more}</span>
              )}
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}

type MatchingRunProps = {
  matching: Matching;
  /** Whether the stream of changes is open; while it is not, the page is read again on a timer. */
  live: boolean;
  /** Whether this screen saw the last run at work: its stages stay, ticked, once it ended. */
  watched: boolean;
  /** What just happened to the solutions, in a sentence; nothing before the first one is read. */
  said: string | null;
  /** Which start is on its way. */
  pending: "run" | "judgeAll" | null;
  /** Starts a run; with `judgeAll` the AI reads every solution again, which only an operator asks. */
  onStart: (judgeAll: boolean) => Promise<void>;
  /** Opens the operators' dialog that adds a solution by hand. */
  onAddByHand: () => void;
};

/**
 * Where the search for solutions stands and how it is started: the run as it goes, by its stages and
 * with a line on what just happened, one that waits and continues by itself, one that failed and why,
 * one that ended with what it did behind a line that opens, and one visible action that looks again. A member is asked first, since a run is one of the few the
 * day allows. Operators find their own two actions under "More". While a run is open and the stream
 * of changes is not, the page is read again every few seconds.
 */
function MatchingRun({
  matching,
  live,
  watched,
  said,
  pending,
  onStart,
  onAddByHand,
}: MatchingRunProps) {
  const t = useTranslations("Matching.run");
  const say = useTranslations();
  const format = useFormatter();
  const [asking, setAsking] = useState<"run" | "judgeAll" | null>(null);
  const { run, operator, modelChosen, runsLeftToday } = matching;

  const time = (instant: string) =>
    format.dateTime(new Date(instant), {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
    });
  const open = run?.state === "queued" || run?.state === "running" || run?.state === "waiting";
  // The stages of a run at work, and of one this screen watched until its end.
  const at = run?.state === "running" || watched ? stageOf(run) : undefined;
  // A run that waits for the brief to stay unchanged starts at once when a person asks.
  const startable = !open || (run?.state === "queued" && Boolean(run.startsAt));
  // The backend sends null where a value is absent: an operator has no limit, and reads no count.
  const limited = typeof runsLeftToday === "number";
  const left = limited ? Math.max(0, runsLeftToday) : 0;
  const blocked = !modelChosen || !startable || (limited && left === 0) || pending !== null;
  const startLabel = t(
    !run ? "start" : run.state === "queued" && run.startsAt ? "startNow" : "again",
  );

  const actions = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {limited && (
        <span className="text-sm text-muted-foreground">{t("left", { count: left })}</span>
      )}
      <Button
        prominence={run ? "secondary" : "primary"}
        pending={pending === "run"}
        disabled={blocked}
        onClick={() => (limited ? setAsking("run") : void onStart(false))}
      >
        {pending !== "run" && run && <RotateCwIcon aria-hidden="true" />}
        {startLabel}
      </Button>
      {operator && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button prominence="tertiary" />}>
            {t("more")}
            <ChevronDownIcon aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="pointer-coarse:min-h-11"
                disabled={pending !== null}
                onClick={onAddByHand}
              >
                <PlusIcon aria-hidden="true" />
                {t("addByHand")}
              </DropdownMenuItem>
              {run && (
                <DropdownMenuItem
                  className="pointer-coarse:min-h-11"
                  disabled={blocked}
                  onClick={() => setAsking("judgeAll")}
                >
                  <ScanSearchIcon aria-hidden="true" />
                  {t("reviewAll")}
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {open && !live && <LiveRefresh />}

      {!modelChosen && (
        <Alert>
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>{t("noModel.title")}</AlertTitle>
          <AlertDescription>
            {operator ? (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {t("noModel.operator")}
                <TextButton href={siteRoutes.adminAiProviders}>{t("noModel.link")}</TextButton>
              </span>
            ) : (
              t("noModel.member")
            )}
          </AlertDescription>
        </Alert>
      )}

      {run?.state === "failed" && (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>{t("failed.title")}</AlertTitle>
          <AlertDescription>{say(describeRunFailure(run.failure))}</AlertDescription>
        </Alert>
      )}

      {!run && (
        <div className="flex rounded-xl border bg-card">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SparklesIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t("never.title")}</EmptyTitle>
              <EmptyDescription>{t("never.lead")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>{actions}</EmptyContent>
          </Empty>
        </div>
      )}

      {run && (
        <div
          data-staged={at !== undefined}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:data-[staged=true]:items-start"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
            {at && (
              <>
                <RunStages at={at} judged={run.judged} total={run.total} />
                {at === "reading" && run.total > 0 && (
                  <Progress
                    aria-label={t("stages.reading")}
                    value={Math.round((run.judged / run.total) * 100)}
                    className="max-w-md"
                  />
                )}
                {/* Always there while the stages are, so that what is written into it is announced. */}
                <p role="status" className="min-h-5 text-muted-foreground">
                  {said}
                </p>
              </>
            )}
            <div className="flex flex-col gap-1" aria-live="polite">
              {run.state === "queued" && (
                <p className="flex items-center gap-2">
                  <Loader2Icon
                    aria-hidden="true"
                    className="size-4 shrink-0 animate-spin text-primary"
                  />
                  {run.startsAt ? t("startsAt", { time: time(run.startsAt) }) : t("queued")}
                </p>
              )}
              {run.state === "waiting" && (
                <>
                  <p className="font-medium">
                    {t("waiting", { judged: run.judged, total: run.total })}
                  </p>
                  <p className="text-muted-foreground">
                    {run.resumesAt ? t("resumesAt", { time: time(run.resumesAt) }) : t("resumes")}
                  </p>
                </>
              )}
              {run.state === "done" && (
                <p className="text-muted-foreground">
                  {/* A member reads when the list was last updated. How many solutions the AI read counts
                    those it put in no group, which the list does not show; that number and the model
                    are the operators'. */}
                  {t(!operator ? "doneWhen" : run.modelName ? "doneModel" : "done", {
                    date: format.dateTime(new Date(run.endedAt ?? run.createdAt), {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Ho_Chi_Minh",
                    }),
                    judged: run.judged,
                    model: run.modelName ?? "",
                  })}
                </p>
              )}
            </div>
            {run.state === "done" && <RunFound matching={matching} />}
          </div>

          {actions}
        </div>
      )}

      <ConfirmDialog
        open={asking === "run"}
        onOpenChange={(next) => setAsking(next ? "run" : null)}
        title={t("runConfirm.title")}
        description={t("runConfirm.description")}
        note={t("runConfirm.note", { count: left })}
        confirmLabel={startLabel}
        cancelLabel={t("runConfirm.cancel")}
        pending={pending === "run"}
        onConfirm={() => void onStart(false).then(() => setAsking(null))}
      />
      <ConfirmDialog
        open={asking === "judgeAll"}
        onOpenChange={(next) => setAsking(next ? "judgeAll" : null)}
        title={t("reviewAllConfirm.title")}
        description={t("reviewAllConfirm.description")}
        note={t("reviewAllConfirm.note")}
        confirmLabel={t("reviewAllConfirm.confirm")}
        cancelLabel={t("reviewAllConfirm.cancel")}
        pending={pending === "judgeAll"}
        onConfirm={() => void onStart(true).then(() => setAsking(null))}
      />
    </div>
  );
}

export { MatchingRun };
