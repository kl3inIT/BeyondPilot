"use client";

import {
  ChevronDownIcon,
  CircleAlertIcon,
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
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { LiveRefresh } from "@/features/usecase/live-refresh";
import type { Matching } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { describeRunFailure } from "./matching-errors";

type MatchingRunProps = {
  matching: Matching;
  /** Which start is on its way. */
  pending: "run" | "judgeAll" | null;
  /** Starts a run; with `judgeAll` the AI reads every solution again, which only an operator asks. */
  onStart: (judgeAll: boolean) => Promise<void>;
  /** Opens the operators' dialog that adds a solution by hand. */
  onAddByHand: () => void;
};

/**
 * Where the search for solutions stands and how it is started: the run as it goes, one that waits and
 * continues by itself, one that failed and why, and one visible action that looks again. A member is
 * asked first, since a run is one of the few the day allows. Operators find their own two actions
 * under "More". While a run is open the page is read again every few seconds.
 */
function MatchingRun({ matching, pending, onStart, onAddByHand }: MatchingRunProps) {
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
      {open && <LiveRefresh />}

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm" aria-live="polite">
            {run.state === "queued" && (
              <p className="flex items-center gap-2">
                <Loader2Icon
                  aria-hidden="true"
                  className="size-4 shrink-0 animate-spin text-primary"
                />
                {run.startsAt ? t("startsAt", { time: time(run.startsAt) }) : t("queued")}
              </p>
            )}
            {run.state === "running" && (
              <Progress
                value={run.total > 0 ? Math.round((run.judged / run.total) * 100) : null}
                className="max-w-md"
              >
                <ProgressLabel>
                  {run.total > 0
                    ? t("running", { judged: run.judged, total: run.total })
                    : t("preparing")}
                </ProgressLabel>
              </Progress>
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
