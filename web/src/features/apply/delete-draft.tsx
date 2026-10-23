"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { useNotify } from "@/hooks/use-notify";
import { useRouter } from "@/i18n/navigation";
import { deleteDraftApplication } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

/**
 * Deletes an application never submitted, after the applicant confirms, then goes back to their
 * applications. Nobody else has seen it, and it cannot be undone, so the question says so.
 */
function DeleteDraft({ id, program }: { id: string; program: string }) {
  const t = useTranslations("Application.deleteDraft");
  const notify = useNotify();
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    try {
      await deleteDraftApplication({ path: { id } });
      notify.success("Application.deleteDraft.done");
      router.push(siteRoutes.myApplications);
    } catch (error) {
      notify.failure(error, { otherwise: "Application.deleteDraft.failed" });
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
          onConfirm={() => void remove()}
        />
      )}
    </>
  );
}

export { DeleteDraft };
