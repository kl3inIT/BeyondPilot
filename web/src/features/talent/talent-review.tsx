"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { ReasonDialog } from "@/components/composites/reason-dialog";
import { reviewState } from "@/components/composites/review-status";
import { Kbd } from "@/components/ui/kbd";
import { useNotify } from "@/hooks/use-notify";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { getPathname } from "@/i18n/navigation";
import { useVocabulary } from "@/i18n/vocabulary";
import {
  approveTalent,
  restoreTalent,
  sendBackTalent,
  takeDownTalent,
  type TalentDecision,
  type TalentProfile,
} from "@/lib/api/generated";

import { talentRejections } from "./talent-codes";
import { talentError } from "./talent-errors";

type TalentReviewProps = {
  profile: Pick<TalentProfile, "id" | "name" | "status" | "suspendedAt">;
  /** The next record that waits for a decision; a decision on a waiting record goes there. */
  nextHref?: string;
};

/**
 * The decision on a talent profile: approve one that waits for review, or send it back with a
 * reason its person reads. An approved profile can be taken down from the public, with a reason
 * too, and one taken down restored. Each decision is emailed to the person.
 */
function TalentReview({ profile, nextHref }: TalentReviewProps) {
  const t = useTranslations("Admin.talent.review");
  const reason = useVocabulary("talentRejection");
  const notify = useNotify();
  const router = useRouter();
  const locale = useLocale();
  const [rejecting, setRejecting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [pending, setPending] = useState<"approve" | "reject" | "restore" | null>(null);
  // Set at the first press, before the pending state has rendered, so presses in one tick decide once.
  const deciding = useRef(false);
  const state = reviewState(profile);
  const waiting = state === "in_review";
  const approved = state === "approved";

  async function decide(kind: "approve" | "reject" | "restore", run: () => Promise<unknown>) {
    if (deciding.current) {
      return;
    }
    deciding.current = true;
    setPending(kind);
    try {
      await run();
      notify.success(
        kind === "approve"
          ? "Talent.done.approved"
          : kind === "restore"
            ? "Talent.done.restored"
            : approved
              ? "Talent.done.takenDown"
              : "Talent.done.sentBack",
        { name: profile.name },
      );
      setRejecting(false);
      setRestoring(false);
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
      notify.error(talentError(error));
      deciding.current = false;
      setPending(null);
    }
  }

  const approve = () => decide("approve", () => approveTalent({ path: { id: profile.id } }));
  // A key does nothing while a decision is on its way, so one press is one decision.
  const idle = pending === null;
  useShortcuts({
    a: waiting && idle ? approve : undefined,
    s: (waiting || approved) && idle ? () => setRejecting(true) : undefined,
  });

  if (state === "suspended") {
    return (
      <>
        <Button prominence="secondary" onClick={() => setRestoring(true)}>
          {t("restore")}
        </Button>
        {restoring && (
          <ConfirmDialog
            open
            onOpenChange={(open) => !open && pending === null && setRestoring(false)}
            title={t("restoreTitle", { name: profile.name })}
            description={t("restoreLead")}
            confirmLabel={t("restore")}
            cancelLabel={t("cancel")}
            pending={pending === "restore"}
            onConfirm={() => decide("restore", () => restoreTalent({ path: { id: profile.id } }))}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        prominence="secondary"
        tone={approved ? "danger" : "default"}
        aria-keyshortcuts="S"
        onClick={() => setRejecting(true)}
      >
        {t(approved ? "takeDown" : "reject")}
        <Kbd aria-hidden="true">S</Kbd>
      </Button>
      {waiting && (
        <Button pending={pending === "approve"} aria-keyshortcuts="A" onClick={approve}>
          {t("approve")}
          <Kbd aria-hidden="true">A</Kbd>
        </Button>
      )}
      {rejecting && (
        <ReasonDialog
          open
          onOpenChange={setRejecting}
          title={t(approved ? "takeDownTitle" : "rejectTitle", {
            name: profile.name,
          })}
          description={t(approved ? "takeDownLead" : "rejectLead")}
          reasonLabel={t("reason")}
          reasonPlaceholder={t("reasonPlaceholder")}
          reasons={talentRejections.map((value) => ({ value, label: reason(value) }))}
          messageLabel={t("message")}
          messageHint={t("messageHint")}
          confirmLabel={t(approved ? "takeDownConfirm" : "rejectConfirm")}
          cancelLabel={t("cancel")}
          pending={pending === "reject"}
          onConfirm={(chosen, message) =>
            decide("reject", () => {
              const decision = {
                path: { id: profile.id },
                body: {
                  reason: chosen as TalentDecision["reason"],
                  message: message.trim() || null,
                },
              };
              return approved ? takeDownTalent(decision) : sendBackTalent(decision);
            })
          }
        />
      )}
    </div>
  );
}

export { TalentReview };
