"use client";

import { useStore } from "@tanstack/react-form";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { FormDialog } from "@/components/composites/form-dialog";
import { useAppForm } from "@/components/form/app-form";
import { useNotify, type MessageKey } from "@/hooks/use-notify";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/client";
import { approveAdminUseCase, sendBackAdminUseCase } from "@/lib/api/generated";

const MAX_REASON = 1000;

type AdminUseCaseDecisionProps = {
  /** A published use case can only be sent back; one in review can also be approved. */
  published?: boolean;
  id: string;
  title: string;
  organization: string;
};

/** The words for a decision that was refused: by its code when the screen knows it. */
function refusal(error: unknown): MessageKey {
  const code = error instanceof ApiError ? error.code : undefined;
  return code === "USECASE_NOT_AWAITING_REVIEW"
    ? "Admin.useCases.errors.USECASE_NOT_AWAITING_REVIEW"
    : code === "USECASE_NOT_FOUND"
      ? "Admin.useCases.errors.USECASE_NOT_FOUND"
      : "Admin.useCases.errors.unknown";
}

/**
 * What an operator decides about a use case in review: approve it, which publishes it at once, or send it
 * back with a reason its organization's members read. Both end with the page read again.
 */
function AdminUseCaseDecision({
  id,
  title,
  organization,
  published = false,
}: AdminUseCaseDecisionProps) {
  const t = useTranslations("Admin.useCases.decision");
  const notify = useNotify();
  const router = useRouter();
  const [approving, setApproving] = useState(false);
  const [open, setOpen] = useState(false);

  const form = useAppForm({
    defaultValues: { reason: "" },
    onSubmit: async ({ value }) => {
      try {
        await sendBackAdminUseCase({ path: { id }, body: { reason: value.reason } });
        notify.success("Admin.useCases.decision.sentBack", { name: title, organization });
        setOpen(false);
        router.refresh();
      } catch (error) {
        notify.error(refusal(error));
      }
    },
  });
  const reason = useStore(form.store, (state) => state.values.reason);

  async function approve() {
    setApproving(true);
    try {
      await approveAdminUseCase({ path: { id } });
      notify.success("Admin.useCases.decision.approved", { name: title });
      router.refresh();
    } catch (error) {
      notify.error(refusal(error));
      router.refresh();
    } finally {
      setApproving(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {!published && (
          <Button size="lg" pending={approving} onClick={approve}>
            {t("approve")}
          </Button>
        )}
        <Button
          size="lg"
          prominence={published ? "primary" : "secondary"}
          disabled={approving}
          onClick={() => setOpen(true)}
        >
          {t("sendBack")}
        </Button>
      </div>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        form={form}
        title={t("dialog.title", { organization })}
        description={t("dialog.description", { organization })}
        width="md"
        submitLabel={t("dialog.confirm")}
        cancelLabel={t("dialog.cancel")}
        submitDisabled={reason.trim() === ""}
      >
        <form.AppField name="reason">
          {(field) => (
            <field.TextareaField
              label={t("dialog.label", { organization })}
              rows={4}
              maxLength={MAX_REASON}
            />
          )}
        </form.AppField>
      </FormDialog>
    </>
  );
}

export { AdminUseCaseDecision };
