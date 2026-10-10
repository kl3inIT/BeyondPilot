"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { useNotify } from "@/hooks/use-notify";
import {
  acceptTalentEnquiry,
  declineTalentEnquiry,
  reportTalentEnquiry,
} from "@/lib/api/generated";

import { talentError } from "./talent-errors";

type Answer = "accept" | "decline" | "report";

const send = {
  accept: acceptTalentEnquiry,
  decline: declineTalentEnquiry,
  report: reportTalentEnquiry,
} as const;

const done = { accept: "accepted", decline: "declined", report: "reported" } as const;

const confirm = { decline: "confirmDecline", report: "confirmReport" } as const;

/**
 * Answers a message to the caller's profile: an acceptance shares both addresses, a decline and a
 * report share none and read the same to the sender. The last two ask first.
 */
function TalentEnquiryActions({ id }: { id: string }) {
  const t = useTranslations("Talent.mine.inbox");
  const notify = useNotify();
  const router = useRouter();
  const noteId = useId();
  const [pending, setPending] = useState<Answer | null>(null);
  const [confirming, setConfirming] = useState<"decline" | "report" | null>(null);

  async function answer(kind: Answer) {
    setPending(kind);
    try {
      await send[kind]({ path: { id } });
      notify.success(`Talent.done.${done[kind]}`);
      setConfirming(null);
      router.refresh();
    } catch (error) {
      notify.error(talentError(error));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          pending={pending === "accept"}
          disabled={pending !== null}
          aria-describedby={noteId}
          onClick={() => answer("accept")}
        >
          {t("accept")}
        </Button>
        <Button
          size="sm"
          prominence="secondary"
          disabled={pending !== null}
          onClick={() => setConfirming("decline")}
        >
          {t("decline")}
        </Button>
        <Button
          size="sm"
          prominence="tertiary"
          tone="danger"
          disabled={pending !== null}
          onClick={() => setConfirming("report")}
        >
          {t("report")}
        </Button>
      </div>
      {/* Accepting does not ask first, so what it shares is said beside it. */}
      <p id={noteId} className="text-xs text-muted-foreground">
        {t("lead")}
      </p>
      {confirming && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setConfirming(null)}
          title={t(`${confirm[confirming]}.title`)}
          description={t(`${confirm[confirming]}.lead`)}
          confirmLabel={t(`${confirm[confirming]}.confirm`)}
          cancelLabel={t(`${confirm[confirming]}.cancel`)}
          tone="danger"
          pending={pending === confirming}
          onConfirm={() => answer(confirming)}
        />
      )}
    </div>
  );
}

export { TalentEnquiryActions };
