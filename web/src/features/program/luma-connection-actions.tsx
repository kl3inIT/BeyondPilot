"use client";

import { revalidateLogic } from "@tanstack/react-form";
import { KeyRoundIcon, UnplugIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { FormDialog } from "@/components/composites/form-dialog";
import { setServerErrors, useAppForm } from "@/components/form/app-form";
import { useFailureWords, useNotify } from "@/hooks/use-notify";
import { failedWith } from "@/lib/api/failure";
import { connectLuma, disconnectLuma } from "@/lib/api/generated";

/**
 * Connects the Luma calendar of a key, or replaces the key in use: BeyondPilot checks it with Luma,
 * keeps it sealed, makes the calendar's webhook and reads the calendar soon after.
 */
function ConnectLuma({ replacing, disabled }: { replacing: boolean; disabled: boolean }) {
  const t = useTranslations("Admin.programs.lumaTab.connect");
  const say = useTranslations("Form.errors");
  const notify = useNotify();
  const words = useFailureWords();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useAppForm({
    defaultValues: { apiKey: "" },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: z.object({ apiKey: z.string().trim().min(1, say("required")).max(200) }),
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        await connectLuma({ body: { apiKey: value.apiKey.trim() } });
        setOpen(false);
        notify.success("Admin.programs.lumaTab.connect.done");
        router.refresh();
      } catch (error) {
        if (failedWith(error, "PROGRAM_LUMA_KEY_REFUSED")) {
          setServerErrors(formApi, { fields: { apiKey: { message: words(error) } } });
        } else {
          notify.failure(error);
        }
      }
    },
  });

  return (
    <>
      <Button
        size="sm"
        prominence={replacing ? "secondary" : "primary"}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <KeyRoundIcon aria-hidden="true" />
        {replacing ? t("replace") : t("open")}
      </Button>
      <FormDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            form.reset();
          }
        }}
        form={form}
        title={replacing ? t("replaceTitle") : t("title")}
        description={t("lead")}
        width="md"
        submitLabel={t("submit")}
        cancelLabel={t("cancel")}
      >
        <form.AppField name="apiKey">
          {(field) => (
            <field.TextField
              label={t("key")}
              type="password"
              autoComplete="off"
              spellCheck={false}
              maxLength={200}
              description={t("keyHint")}
            />
          )}
        </form.AppField>
      </FormDialog>
    </>
  );
}

/** Stops reading the calendar: the key and its webhook go, and the programs it brought stay. */
function DisconnectLuma({ calendar }: { calendar: string }) {
  const t = useTranslations("Admin.programs.lumaTab.disconnect");
  const notify = useNotify();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function disconnect() {
    setPending(true);
    try {
      await disconnectLuma();
      setOpen(false);
      notify.success("Admin.programs.lumaTab.disconnect.done");
      router.refresh();
    } catch (error) {
      notify.failure(error);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button size="sm" prominence="secondary" tone="danger" onClick={() => setOpen(true)}>
        <UnplugIcon aria-hidden="true" />
        {t("open")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("title", { calendar })}
        description={t("description")}
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        tone="danger"
        pending={pending}
        onConfirm={disconnect}
      />
    </>
  );
}

export { ConnectLuma, DisconnectLuma };
