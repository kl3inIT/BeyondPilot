"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { ReasonDialog } from "@/components/composites/reason-dialog";
import { reviewState } from "@/components/composites/review-status";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useNotify } from "@/hooks/use-notify";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { getPathname } from "@/i18n/navigation";
import { useVocabulary } from "@/i18n/vocabulary";
import {
  approveSolution,
  rejectSolution,
  restoreSolution,
  sendBackSolution,
  takeDownSolution,
  type RejectSolution,
  type Solution,
  type TakeDownSolution,
} from "@/lib/api/generated";

import { solutionRejections, solutionTakedowns } from "./solution-codes";
import { solutionError } from "./solution-errors";

/** The longest reason for a send back that the backend takes. */
const MAX_REASON = 1000;

type Decision = "approve" | "sendBack" | "reject" | "takeDown" | "restore";

const done = {
  approve: "Solution.done.approved",
  sendBack: "Solution.done.sentBack",
  reject: "Solution.done.rejected",
  takeDown: "Solution.done.takenDown",
  restore: "Solution.done.restored",
} as const;

type SolutionReviewProps = {
  solution: Pick<Solution, "id" | "name" | "status" | "suspendedAt">;
  /** The next record that waits for a decision; a decision on a waiting record goes there. */
  nextHref?: string;
};

/**
 * The decision on a solution. One that waits for review is approved, sent back with what its
 * owners should change, or rejected for good with a reason. An approved one can be taken down
 * from the directory and matching with a reason, and one taken down restored. Each decision is
 * emailed to the members of its organization.
 */
function SolutionReview({ solution, nextHref }: SolutionReviewProps) {
  const t = useTranslations("Admin.solutions.review");
  const rejection = useVocabulary("solutionRejection");
  const takedown = useVocabulary("solutionTakedown");
  const notify = useNotify();
  const router = useRouter();
  const locale = useLocale();
  const [open, setOpen] = useState<Exclude<Decision, "approve"> | null>(null);
  const [sendBackReason, setSendBackReason] = useState("");
  const sendBackId = useId();
  const [pending, setPending] = useState<Decision | null>(null);
  // Set at the first press, before the pending state has rendered, so presses in one tick decide once.
  const deciding = useRef(false);
  const state = reviewState(solution);
  const waiting = state === "in_review";
  const { id, name } = solution;

  async function decide(kind: Decision, run: () => Promise<unknown>) {
    if (deciding.current) {
      return;
    }
    deciding.current = true;
    setPending(kind);
    try {
      await run();
      notify.success(done[kind], { name });
      setOpen(null);
      // A decision on a record of the queue moves on to the next one that waits.
      // It stays pending until that page arrives, so a second press cannot decide twice.
      if (waiting && nextHref) {
        router.push(getPathname({ href: nextHref, locale }));
      } else {
        router.refresh();
        deciding.current = false;
        setPending(null);
      }
    } catch (error) {
      notify.error(solutionError(error));
      deciding.current = false;
      setPending(null);
    }
  }

  const approve = () => decide("approve", () => approveSolution({ path: { id } }));
  // A key does nothing while a decision is on its way, so one press is one decision.
  const idle = pending === null;
  useShortcuts({
    a: waiting && idle ? approve : undefined,
    s: idle && waiting ? () => setOpen("sendBack") : undefined,
  });

  const dialogs = (
    <>
      {open === "sendBack" && (
        <Dialog open onOpenChange={(next) => !next && pending === null && setOpen(null)}>
          <DialogContent showCloseButton={false} className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("sendBackTitle", { name })}</DialogTitle>
              <DialogDescription>{t("sendBackLead")}</DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor={sendBackId}>{t("sendBackLabel")}</FieldLabel>
              <Textarea
                id={sendBackId}
                rows={4}
                maxLength={MAX_REASON}
                value={sendBackReason}
                onChange={(event) => setSendBackReason(event.target.value)}
              />
            </Field>
            <DialogFooter>
              <Button
                prominence="secondary"
                disabled={pending !== null}
                onClick={() => setOpen(null)}
              >
                {t("cancel")}
              </Button>
              <Button
                pending={pending === "sendBack"}
                disabled={sendBackReason.trim() === ""}
                onClick={() =>
                  void decide("sendBack", () =>
                    sendBackSolution({ path: { id }, body: { reason: sendBackReason.trim() } }),
                  )
                }
              >
                {t("sendBackConfirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {open === "reject" && (
        <ReasonDialog
          open
          onOpenChange={(next) => !next && setOpen(null)}
          title={t("rejectTitle", { name })}
          description={t("rejectLead")}
          reasonLabel={t("reason")}
          reasonPlaceholder={t("reasonPlaceholder")}
          reasons={solutionRejections.map((value) => ({ value, label: rejection(value) }))}
          messageLabel={t("message")}
          messageHint={t("messageHint")}
          confirmLabel={t("rejectConfirm")}
          cancelLabel={t("cancel")}
          pending={pending === "reject"}
          onConfirm={(chosen, message) =>
            decide("reject", () =>
              rejectSolution({
                path: { id },
                body: {
                  reason: chosen as RejectSolution["reason"],
                  message: message.trim() || null,
                },
              }),
            )
          }
        />
      )}
      {open === "takeDown" && (
        <ReasonDialog
          open
          onOpenChange={(next) => !next && setOpen(null)}
          title={t("takeDownTitle", { name })}
          description={t("takeDownLead")}
          reasonLabel={t("reason")}
          reasonPlaceholder={t("reasonPlaceholder")}
          reasons={solutionTakedowns.map((value) => ({ value, label: takedown(value) }))}
          messageLabel={t("message")}
          messageHint={t("messageHint")}
          confirmLabel={t("takeDownConfirm")}
          cancelLabel={t("cancel")}
          pending={pending === "takeDown"}
          onConfirm={(chosen, message) =>
            decide("takeDown", () =>
              takeDownSolution({
                path: { id },
                body: {
                  reason: chosen as TakeDownSolution["reason"],
                  message: message.trim() || null,
                },
              }),
            )
          }
        />
      )}
      {open === "restore" && (
        <ConfirmDialog
          open
          onOpenChange={(next) => !next && pending === null && setOpen(null)}
          title={t("restoreTitle", { name })}
          description={t("restoreLead")}
          confirmLabel={t("restore")}
          cancelLabel={t("cancel")}
          pending={pending === "restore"}
          onConfirm={() => decide("restore", () => restoreSolution({ path: { id } }))}
        />
      )}
    </>
  );

  if (state === "suspended") {
    return (
      <div className="flex flex-col gap-2">
        <Button className="w-full" prominence="secondary" onClick={() => setOpen("restore")}>
          {t("restore")}
        </Button>
        {dialogs}
      </div>
    );
  }

  if (state === "approved") {
    return (
      <div className="flex flex-col gap-2">
        <Button
          className="w-full"
          prominence="secondary"
          tone="danger"
          onClick={() => setOpen("takeDown")}
        >
          {t("takeDown")}
        </Button>
        {dialogs}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button className="w-full" pending={pending === "approve"} onClick={approve}>
        {t("approve")}
      </Button>
      <Button className="w-full" prominence="secondary" onClick={() => setOpen("sendBack")}>
        {t("sendBack")}
      </Button>
      <Button
        className="w-full"
        prominence="tertiary"
        tone="danger"
        onClick={() => setOpen("reject")}
      >
        {t("reject")}
      </Button>
      {dialogs}
      <p className="text-xs text-muted-foreground">{t("keys")}</p>
    </div>
  );
}

export { SolutionReview };
