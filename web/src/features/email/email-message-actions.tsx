"use client";

import { RotateCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { useNotify } from "@/hooks/use-notify";
import type { FailureWords } from "@/lib/api/failure";
import { resendEmailMessage, type EmailMessage } from "@/lib/api/generated";
import { adminEmailMessageRoute } from "@/lib/site";

/** What a resend says in its own words: here incomplete settings are another screen's to fix. */
const resendWords = {
  NOTIFICATION_SETTINGS_INCOMPLETE: "Admin.email.message.resend.errors.notReady",
  otherwise: "Admin.email.message.resend.errors.unknown",
} as const satisfies FailureWords;

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
      notify.failure(error, resendWords);
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
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        pending={pending}
        onConfirm={() => void resend()}
      />
    </>
  );
}

export { EmailMessageActions };
