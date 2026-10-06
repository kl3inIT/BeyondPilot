"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Button } from "@/components/actions/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useNotify, type MessageKey } from "@/hooks/use-notify";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/client";
import { approveAdminUseCase, sendBackAdminUseCase } from "@/lib/api/generated";

const MAX_REASON = 1000;

type AdminUseCaseDecisionProps = {
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
function AdminUseCaseDecision({ id, title, organization }: AdminUseCaseDecisionProps) {
  const t = useTranslations("Admin.useCases.decision");
  const notify = useNotify();
  const router = useRouter();
  const reasonId = useId();
  const [pending, setPending] = useState<"approve" | "sendBack" | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function approve() {
    setPending("approve");
    try {
      await approveAdminUseCase({ path: { id } });
      notify.success("Admin.useCases.decision.approved", { name: title });
      router.refresh();
    } catch (error) {
      notify.error(refusal(error));
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function sendBack() {
    setPending("sendBack");
    try {
      await sendBackAdminUseCase({ path: { id }, body: { reason } });
      notify.success("Admin.useCases.decision.sentBack", { name: title, organization });
      setOpen(false);
      setReason("");
      router.refresh();
    } catch (error) {
      notify.error(refusal(error));
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <Button
          size="lg"
          pending={pending === "approve"}
          disabled={pending !== null}
          onClick={approve}
        >
          {t("approve")}
        </Button>
        <Button
          size="lg"
          prominence="secondary"
          disabled={pending !== null}
          onClick={() => setOpen(true)}
        >
          {t("sendBack")}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dialog.title", { organization })}</DialogTitle>
            <DialogDescription>{t("dialog.description", { organization })}</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={reasonId}>{t("dialog.label", { organization })}</FieldLabel>
            <Textarea
              id={reasonId}
              rows={4}
              maxLength={MAX_REASON}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <FieldDescription>{t("dialog.hint", { organization })}</FieldDescription>
          </Field>
          <DialogFooter>
            <Button
              prominence="secondary"
              disabled={pending !== null}
              onClick={() => setOpen(false)}
            >
              {t("dialog.cancel")}
            </Button>
            <Button
              pending={pending === "sendBack"}
              disabled={reason.trim() === "" || pending !== null}
              onClick={sendBack}
            >
              {t("dialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { AdminUseCaseDecision };
