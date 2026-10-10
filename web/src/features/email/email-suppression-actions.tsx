"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useNotify } from "@/hooks/use-notify";
import { ApiError } from "@/lib/api/client";
import {
  addEmailSuppression,
  removeEmailSuppression,
  type EmailSuppression,
} from "@/lib/api/generated";

/** One address, loosely: something before and after one @. The backend checks it exactly. */
const ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Stops email to an address an operator names, as when its reader asks for no more email. */
function AddSuppressionButton() {
  const t = useTranslations("Admin.email.suppressions.add");
  const notify = useNotify();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [problem, setProblem] = useState<"invalid" | "exists" | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = address.trim();
    if (!ADDRESS.test(value)) {
      setProblem("invalid");
      return;
    }
    setPending(true);
    try {
      await addEmailSuppression({ body: { address: value } });
      notify.success("Admin.email.suppressions.add.done", { email: value });
      setOpen(false);
      setAddress("");
      setProblem(null);
      router.refresh();
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      if (code === "NOTIFICATION_SUPPRESSION_EXISTS") {
        setProblem("exists");
      } else if (error instanceof ApiError && error.violations.length > 0) {
        setProblem("invalid");
      } else {
        notify.error("Admin.email.suppressions.errors.unknown");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon aria-hidden="true" />
        {t("open")}
      </Button>
      <Dialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <form noValidate onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{t("title")}</DialogTitle>
              <DialogDescription>{t("lead")}</DialogDescription>
            </DialogHeader>
            <Field data-invalid={problem !== null || undefined}>
              <FieldLabel htmlFor="suppression-address">{t("address")}</FieldLabel>
              <Input
                id="suppression-address"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={254}
                value={address}
                onChange={(event) => {
                  setAddress(event.target.value);
                  setProblem(null);
                }}
                aria-invalid={problem !== null || undefined}
              />
              {problem && <FieldError>{t(problem)}</FieldError>}
            </Field>
            <DialogFooter>
              <Button prominence="secondary" disabled={pending} onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" pending={pending}>
                {t("confirm")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Lets email reach an address again. For an address that bounced or complained, the dialog says
 * what that risks: the provider counts every new bounce or complaint against the sender.
 */
function RemoveSuppressionButton({
  address,
  reason,
}: {
  address: string;
  reason: EmailSuppression["reason"];
}) {
  const t = useTranslations("Admin.email.suppressions.remove");
  const notify = useNotify();
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    try {
      await removeEmailSuppression({ path: { address } });
      notify.success("Admin.email.suppressions.remove.done", { email: address });
      router.refresh();
    } catch {
      notify.error("Admin.email.suppressions.errors.unknown");
    } finally {
      setPending(false);
      setAsking(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={t("open", { email: address })}
        onClick={() => setAsking(true)}
        className="hit-area flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Trash2Icon aria-hidden="true" className="size-4" />
      </button>
      <ConfirmDialog
        open={asking}
        onOpenChange={(open) => !open && setAsking(false)}
        title={t("title")}
        description={t("lead", { email: address })}
        note={reason === "manual" ? t("noteManual") : t("noteProvider")}
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        tone={reason === "manual" ? "default" : "danger"}
        pending={pending}
        onConfirm={() => void remove()}
      />
    </>
  );
}

export { AddSuppressionButton, RemoveSuppressionButton };
