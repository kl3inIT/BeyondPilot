"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { ReasonDialog } from "@/components/composites/reason-dialog";
import { useNotify } from "@/hooks/use-notify";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { getPathname } from "@/i18n/navigation";
import { useVocabulary } from "@/i18n/vocabulary";
import {
  approveSolution,
  rejectSolution,
  type RejectSolution,
  type Solution,
} from "@/lib/api/generated";

import { solutionRejections } from "./solution-codes";
import { solutionError } from "./solution-errors";

/**
 * The decision on a solution: approve one that waits for review, or reject it with a reason its
 * owners read. An approved solution can be rejected too, which takes it out of the directory.
 */
type SolutionReviewProps = {
  solution: Pick<Solution, "id" | "name" | "status">;
  /** The next record that waits for a decision; a decision on a waiting record goes there. */
  nextHref?: string;
};

function SolutionReview({ solution, nextHref }: SolutionReviewProps) {
  const t = useTranslations("Admin.solutions.review");
  const reason = useVocabulary("solutionRejection");
  const notify = useNotify();
  const router = useRouter();
  const locale = useLocale();
  const [rejecting, setRejecting] = useState(false);
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  // Set at the first press, before the pending state has rendered, so presses in one tick decide once.
  const deciding = useRef(false);

  async function decide(kind: "approve" | "reject", run: () => Promise<unknown>) {
    if (deciding.current) {
      return;
    }
    deciding.current = true;
    setPending(kind);
    try {
      await run();
      notify.success(kind === "approve" ? "Solution.done.approved" : "Solution.done.rejected", {
        name: solution.name,
      });
      setRejecting(false);
      // A decision on a record of the queue moves on to the next one that waits.
      // It stays pending until that page arrives, so a second press cannot decide twice.
      if (solution.status === "submitted" && nextHref) {
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

  const waiting = solution.status === "submitted";
  const approve = () => decide("approve", () => approveSolution({ path: { id: solution.id } }));
  // A key does nothing while a decision is on its way, so one press is one decision.
  const idle = pending === null;
  useShortcuts({
    a: waiting && idle ? approve : undefined,
    s: idle ? () => setRejecting(true) : undefined,
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2">
        {solution.status === "submitted" && (
          <Button className="w-full" pending={pending === "approve"} onClick={approve}>
            {t("approve")}
          </Button>
        )}
        <Button
          className="w-full"
          prominence="secondary"
          tone="danger"
          onClick={() => setRejecting(true)}
        >
          {t(solution.status === "approved" ? "takeDown" : "reject")}
        </Button>
        {rejecting && (
          <ReasonDialog
            open
            onOpenChange={setRejecting}
            title={t(solution.status === "approved" ? "takeDownTitle" : "rejectTitle", {
              name: solution.name,
            })}
            description={t(solution.status === "approved" ? "takeDownLead" : "rejectLead")}
            reasonLabel={t("reason")}
            reasonPlaceholder={t("reasonPlaceholder")}
            reasons={solutionRejections.map((value) => ({ value, label: reason(value) }))}
            messageLabel={t("message")}
            messageHint={t("messageHint")}
            confirmLabel={t(solution.status === "approved" ? "takeDownConfirm" : "rejectConfirm")}
            cancelLabel={t("cancel")}
            pending={pending === "reject"}
            onConfirm={(chosen, message) =>
              decide("reject", () =>
                rejectSolution({
                  path: { id: solution.id },
                  body: {
                    reason: chosen as RejectSolution["reason"],
                    message: message.trim() || null,
                  },
                }),
              )
            }
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t(waiting ? "keys" : "keysApproved")}</p>
    </div>
  );
}

export { SolutionReview };
