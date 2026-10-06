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
  approveTalent,
  removeTalent,
  requestTalentChanges,
  type TalentDecision,
  type TalentProfile,
} from "@/lib/api/generated";

import { talentRejections } from "./talent-codes";
import { talentError } from "./talent-errors";

type TalentReviewProps = {
  profile: Pick<TalentProfile, "id" | "name" | "status">;
  /** The next record that waits for a decision; a decision on a waiting record goes there. */
  nextHref?: string;
};

/**
 * The decision on a talent profile: approve one that waits for review, or ask for changes with a
 * reason its person reads. An approved profile can be removed from the public, with a reason too.
 * Each decision is emailed to the person.
 */
function TalentReview({ profile, nextHref }: TalentReviewProps) {
  const t = useTranslations("Admin.talent.review");
  const reason = useVocabulary("talentRejection");
  const notify = useNotify();
  const router = useRouter();
  const locale = useLocale();
  const [rejecting, setRejecting] = useState(false);
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  // Set at the first press, before the pending state has rendered, so presses in one tick decide once.
  const deciding = useRef(false);
  const waiting = profile.status === "submitted";
  const approved = profile.status === "approved";

  async function decide(kind: "approve" | "reject", run: () => Promise<unknown>) {
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
          : approved
            ? "Talent.done.removed"
            : "Talent.done.changesRequested",
        { name: profile.name },
      );
      setRejecting(false);
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
    s: idle ? () => setRejecting(true) : undefined,
  });

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        prominence="secondary"
        tone={approved ? "danger" : "default"}
        aria-keyshortcuts="S"
        title={t("keyS")}
        onClick={() => setRejecting(true)}
      >
        {t(approved ? "takeDown" : "reject")}
      </Button>
      {waiting && (
        <Button
          pending={pending === "approve"}
          aria-keyshortcuts="A"
          title={t("keyA")}
          onClick={approve}
        >
          {t("approve")}
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
              return approved ? removeTalent(decision) : requestTalentChanges(decision);
            })
          }
        />
      )}
    </div>
  );
}

export { TalentReview };
