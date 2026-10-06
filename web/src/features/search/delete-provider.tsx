"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { useNotify } from "@/hooks/use-notify";
import { deleteAiProvider, type AiProvider } from "@/lib/api/generated";

import { aiError } from "./admin-ai-errors";

/**
 * Deletes a provider and its key, after asking. Search keeps its provider: one in use cannot be
 * deleted, so its button is off and its row says why.
 */
function DeleteProvider({ provider }: { provider: AiProvider }) {
  const t = useTranslations("Admin.ai.delete");
  const notify = useNotify();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    try {
      await deleteAiProvider({ path: { id: provider.id } });
      notify.success("Admin.ai.done.deleted", { name: provider.name });
      router.refresh();
    } catch (error) {
      notify.error(aiError(error));
    } finally {
      setPending(false);
      setOpen(false);
    }
  }

  return (
    <>
      <Button
        prominence="tertiary"
        size="sm"
        disabled={provider.inUse}
        onClick={() => setOpen(true)}
      >
        {t("open")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("title", { name: provider.name })}
        description={t("lead")}
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        tone="danger"
        pending={pending}
        onConfirm={confirm}
      />
    </>
  );
}

export { DeleteProvider };
