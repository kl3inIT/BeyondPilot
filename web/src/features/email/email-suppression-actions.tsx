"use client";

import { revalidateLogic, useStore } from "@tanstack/react-form";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { setServerErrors, useAppForm } from "@/components/form/app-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

  const form = useAppForm({
    defaultValues: { address: "" },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: z.object({ address: z.string().trim().regex(ADDRESS, t("invalid")) }),
    },
    onSubmit: async ({ value, formApi }) => {
      const address = value.address.trim();
      try {
        await addEmailSuppression({ body: { address } });
        notify.success("Admin.email.suppressions.add.done", { email: address });
        setOpen(false);
        formApi.reset();
        router.refresh();
      } catch (error) {
        const code = error instanceof ApiError ? error.code : undefined;
        if (code === "NOTIFICATION_SUPPRESSION_EXISTS") {
          setServerErrors(formApi, { fields: { address: { message: t("exists") } } });
        } else if (error instanceof ApiError && error.violations.length > 0) {
          setServerErrors(formApi, { fields: { address: { message: t("invalid") } } });
        } else {
          notify.error("Admin.email.suppressions.errors.unknown");
        }
      }
    },
  });
  const pending = useStore(form.store, (state) => state.isSubmitting);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon aria-hidden="true" />
        {t("open")}
      </Button>
      <Dialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <form
            id={form.formId}
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <DialogHeader>
              <DialogTitle>{t("title")}</DialogTitle>
              <DialogDescription>{t("lead")}</DialogDescription>
            </DialogHeader>
            <form.AppField name="address">
              {(field) => (
                <field.TextField
                  label={t("address")}
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={254}
                />
              )}
            </form.AppField>
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
 * Lets email reach an address again. An address an operator added is let through at once, and the
 * toast offers Undo, which adds it back. For an address that bounced or complained the provider's
 * record cannot be put back, so the dialog asks once and says what it risks: the provider counts
 * every new bounce or complaint against the sender.
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
      notify.success(
        "Admin.email.suppressions.remove.done",
        { email: address },
        reason === "manual" ? { undo: () => void addBack() } : undefined,
      );
      router.refresh();
    } catch {
      notify.error("Admin.email.suppressions.errors.unknown");
    } finally {
      setPending(false);
      setAsking(false);
    }
  }

  async function addBack() {
    try {
      await addEmailSuppression({ body: { address } });
      notify.success("Admin.email.suppressions.add.done", { email: address });
      router.refresh();
    } catch {
      notify.error("Admin.email.suppressions.errors.unknown");
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={t("open", { email: address })}
        aria-busy={pending || undefined}
        disabled={pending}
        onClick={() => (reason === "manual" ? void remove() : setAsking(true))}
        className="hit-area flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Trash2Icon aria-hidden="true" className="size-4" />
      </button>
      <ConfirmDialog
        open={asking}
        onOpenChange={(open) => !open && setAsking(false)}
        title={t("title")}
        description={t("lead", { email: address })}
        note={t("noteProvider")}
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        tone="danger"
        pending={pending}
        onConfirm={() => void remove()}
      />
    </>
  );
}

export { AddSuppressionButton, RemoveSuppressionButton };
