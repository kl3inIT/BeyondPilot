"use client";

import { RotateCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { useNotify, type MessageKey } from "@/hooks/use-notify";
import { ApiError } from "@/lib/api/client";
import { resendEmailMessage, type EmailMessage } from "@/lib/api/generated";
import { adminEmailMessageRoute } from "@/lib/site";

/** The refusals of a resend, each with its own words. */
const refusals: Record<string, MessageKey> = {
  NOTIFICATION_MESSAGE_NOT_RESENDABLE: "Admin.email.message.resend.errors.notResendable",
  NOTIFICATION_ADDRESS_SUPPRESSED: "Admin.email.message.resend.errors.suppressed",
  NOTIFICATION_SETTINGS_INCOMPLETE: "Admin.email.message.resend.errors.notReady",
};

/**
 * Sends an email again, as a new email with the content of this one. A sign-in code is never sent
 * again: it has expired, and the person asks for a new one.
 */
function EmailMessageActions({ message }: { message: EmailMessage }) {
  const t = useTranslations("Admin.email.message.resend");
  const notify = useNotify();
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);

  if (!message.resendable) {
    return null;
  }

  async function resend() {
    setPending(true);
    try {
      const { data } = await resendEmailMessage({ path: { id: message.id } });
      notify.success("Admin.email.message.resend.done", { email: message.recipient });
      router.push(adminEmailMessageRoute(data.id));
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      notify.error((code && refusals[code]) || "Admin.email.message.resend.errors.unknown");
    } finally {
      setPending(false);
      setAsking(false);
    }
  }

  return (
    <>
      <Button prominence="secondary" size="sm" onClick={() => setAsking(true)}>
        <RotateCwIcon aria-hidden="true" />
        {t("action")}
      </Button>
      <ConfirmDialog
        open={asking}
        onOpenChange={(open) => !open && setAsking(false)}
        title={t("title")}
        description={t("lead", { email: message.recipient })}
        note={t("note")}
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        pending={pending}
        onConfirm={() => void resend()}
      />
    </>
  );
}

export { EmailMessageActions };
