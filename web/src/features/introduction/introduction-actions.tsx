"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { useNotify } from "@/hooks/use-notify";
import { declineIntroduction, replyToIntroduction } from "@/lib/api/generated";

import { introductionError } from "./introduction-errors";

type IntroductionActionsProps = {
  id: string;
  /** What the request is about, as it names the dialog of a decline. */
  solutionName: string;
};

/** Answers a request for an introduction: a reply shares both addresses, a decline shares none. */
function IntroductionActions({ id, solutionName }: IntroductionActionsProps) {
  const t = useTranslations("Introduction.received.actions");
  const notify = useNotify();
  const router = useRouter();
  const replyHintId = useId();
  const [pending, setPending] = useState<"reply" | "decline" | null>(null);
  const [declining, setDeclining] = useState(false);

  async function answer(kind: "reply" | "decline") {
    setPending(kind);
    try {
      await (kind === "reply"
        ? replyToIntroduction({ path: { id } })
        : declineIntroduction({ path: { id } }));
      notify.success(`Introduction.received.done.${kind}`);
      setDeclining(false);
      router.refresh();
    } catch (error) {
      notify.error(introductionError(error));
      setPending(null);
      return;
    }
    setPending(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* A reply asks nothing first, so what it shares is said beside it. */}
      <span id={replyHintId} className="text-xs">
        {t("replyHint")}
      </span>
      <Button
        size="sm"
        pending={pending === "reply"}
        disabled={pending !== null}
        aria-describedby={replyHintId}
        onClick={() => answer("reply")}
      >
        {t("reply")}
      </Button>
      <Button
        size="sm"
        prominence="secondary"
        disabled={pending !== null}
        onClick={() => setDeclining(true)}
      >
        {t("decline")}
      </Button>
      {declining && (
        <ConfirmDialog
          open
          onOpenChange={setDeclining}
          title={t("confirmDecline.title", { name: solutionName })}
          description={t("confirmDecline.lead")}
          confirmLabel={t("confirmDecline.confirm")}
          cancelLabel={t("confirmDecline.cancel")}
          tone="danger"
          pending={pending === "decline"}
          onConfirm={() => answer("decline")}
        />
      )}
    </div>
  );
}

export { IntroductionActions };
