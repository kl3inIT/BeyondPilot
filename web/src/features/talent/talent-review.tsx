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
          : profile.status === "approved"
            ? "Talent.done.removed"
            : "Talent.done.changesRequested",
        { name: profile.name },
      );
      setRejecting(false);
      // A decision on a record of the queue moves on to the next one that waits.
      // It stays pending until that page arrives, so a second press cannot decide twice.
      if (profile.status === "submitted" && nextHref) {
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

  const waiting = profile.status === "submitted";
  const approve = () => decide("approve", () => approveTalent({ path: { id: profile.id } }));
  // A key does nothing while a decision is on its way, so one press is one decision.
  const idle = pending === null;
  useShortcuts({
    a: waiting && idle ? approve : undefined,
    s: idle ? () => setRejecting(true) : undefined,
  });

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        {profile.status === "submitted" && (
          <Button pending={pending === "approve"} onClick={approve}>
            {t("approve")}
          </Button>
        )}
        <Button prominence="secondary" tone="danger" onClick={() => setRejecting(true)}>
          {t(profile.status === "approved" ? "takeDown" : "reject")}
        </Button>
        {rejecting && (
          <ReasonDialog
            open
            onOpenChange={setRejecting}
            title={t(profile.status === "approved" ? "takeDownTitle" : "rejectTitle", {
              name: profile.name,
            })}
            description={t(profile.status === "approved" ? "takeDownLead" : "rejectLead")}
            reasonLabel={t("reason")}
            reasonPlaceholder={t("reasonPlaceholder")}
            reasons={talentRejections.map((value) => ({ value, label: reason(value) }))}
            messageLabel={t("message")}
            messageHint={t("messageHint")}
            confirmLabel={t(profile.status === "approved" ? "takeDownConfirm" : "rejectConfirm")}
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
                return profile.status === "approved"
                  ? removeTalent(decision)
                  : requestTalentChanges(decision);
              })
            }
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t(waiting ? "keys" : "keysApproved")}</p>
    </div>
  );
}

export { TalentReview };
