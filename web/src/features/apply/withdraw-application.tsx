"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { useNotify } from "@/hooks/use-notify";
import { ApiError } from "@/lib/api/client";
import { withdrawApplication } from "@/lib/api/generated";

/**
 * Withdraws a submitted application after the applicant confirms. It can be changed and submitted
 * again while the program still takes applications.
 */
function WithdrawApplication({ id, program }: { id: string; program: string }) {
  const t = useTranslations("Application.withdraw");
  const notify = useNotify();
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);

  async function withdraw() {
    setPending(true);
    try {
      await withdrawApplication({ path: { id } });
      notify.success("Application.withdraw.done");
      router.refresh();
    } catch (error) {
      notify.error(
        error instanceof ApiError && error.code === "PROPOSAL_CLOSED"
          ? "Application.withdraw.closed"
          : "Application.withdraw.failed",
      );
    } finally {
      setPending(false);
      setAsking(false);
    }
  }

  return (
    <>
      <Button prominence="tertiary" tone="danger" onClick={() => setAsking(true)}>
        {t("button")}
      </Button>
      {asking && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setAsking(false)}
          title={t("title", { program })}
          description={t("lead")}
          confirmLabel={t("confirm")}
          cancelLabel={t("cancel")}
          tone="danger"
          pending={pending}
          onConfirm={() => void withdraw()}
        />
      )}
    </>
  );
}

export { WithdrawApplication };
