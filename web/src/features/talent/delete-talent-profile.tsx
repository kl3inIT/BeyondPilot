"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { useNotify } from "@/hooks/use-notify";
import { deleteMyTalentProfile } from "@/lib/api/generated";

import { talentError } from "./talent-errors";

/**
 * Deletes the caller's talent profile, its projects and the messages sent through it, after asking.
 * The page is read again and offers a new, empty profile.
 */
function DeleteTalentProfile() {
  const t = useTranslations("Talent.mine.delete");
  const notify = useNotify();
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    try {
      await deleteMyTalentProfile();
      notify.success("Talent.done.deleted");
      setAsking(false);
      router.refresh();
    } catch (error) {
      notify.error(talentError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex max-w-3xl justify-start border-t pt-6">
      <Button prominence="tertiary" tone="danger" onClick={() => setAsking(true)}>
        {t("action")}
      </Button>
      {asking && (
        <ConfirmDialog
          open
          onOpenChange={setAsking}
          title={t("title")}
          description={t("lead")}
          confirmLabel={t("confirm")}
          cancelLabel={t("cancel")}
          tone="danger"
          pending={pending}
          onConfirm={remove}
        />
      )}
    </div>
  );
}

export { DeleteTalentProfile };
