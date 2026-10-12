"use client";

import { revalidateLogic, useStore } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/actions/button";
import { useAppForm } from "@/components/form/app-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RequiredMark } from "@/components/composites/required-mark";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useNotify } from "@/hooks/use-notify";
import { sendTalentEnquiry, type SendTalentEnquiry } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

type EnquiryTopic = SendTalentEnquiry["topic"];

const topics = ["project", "role", "other"] as const satisfies readonly EnquiryTopic[];
const MAX_MESSAGE = 2000;

type TalentEnquiryProps = {
  slug: string;
  /** The person the message goes to, as their profile names them. */
  name: string;
  /** The caller's name as their account holds it, to start the field with; empty when it has none. */
  senderName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * "Contact …": the name the sender signs with, what the message is about and the message itself.
 * The person reads it with that name and the sender's organization and answers in their workspace;
 * neither address is shared unless they accept. Once sent, the page is read again so it shows the
 * message waiting.
 */
function TalentEnquiry({ slug, name, senderName, open, onOpenChange }: TalentEnquiryProps) {
  const t = useTranslations("Talent.enquiry");
  const notify = useNotify();
  const router = useRouter();
  const [sent, setSent] = useState(false);

  const form = useAppForm({
    defaultValues: { signature: senderName, topic: "project" as EnquiryTopic, message: "" },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: z.object({
        signature: z.string().refine((text) => text.trim() !== "", t("senderNameRequired")),
        topic: z.enum(topics),
        message: z.string().refine((text) => text.trim() !== "", t("required")),
      }),
    },
    onSubmit: async ({ value }) => {
      try {
        await sendTalentEnquiry({
          path: { slug },
          body: { senderName: value.signature, topic: value.topic, message: value.message },
        });
        setSent(true);
      } catch (error) {
        notify.failure(error);
      }
    },
  });
  const pending = useStore(form.store, (state) => state.isSubmitting);

  function close(next: boolean) {
    if (pending) {
      return;
    }
    onOpenChange(next);
    if (!next && sent) {
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent showCloseButton={false}>
        {sent ? (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{t("sentTitle", { name })}</DialogTitle>
              <DialogDescription>{t("sentLead")}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button prominence="secondary" size="lg" href={siteRoutes.talentSent}>
                {t("seeSent")}
              </Button>
              <Button size="lg" onClick={() => close(false)}>
                {t("done")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
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
              <DialogTitle>{t("dialogTitle", { name })}</DialogTitle>
              <DialogDescription>{t("dialogLead", { name })}</DialogDescription>
            </DialogHeader>
            <form.AppField name="signature">
              {(field) => (
                <field.TextField
                  label={t("senderName")}
                  requiredMark
                  autoComplete="name"
                  maxLength={120}
                  description={t("senderNameHint", { name })}
                />
              )}
            </form.AppField>
            <form.Field name="topic">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="talent-enquiry-topic">
                    {t("topic")}
                    <RequiredMark />
                  </FieldLabel>
                  <NativeSelect
                    id="talent-enquiry-topic"
                    className="w-full"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value as EnquiryTopic)}
                  >
                    {topics.map((value) => (
                      <NativeSelectOption key={value} value={value}>
                        {t(`topics.${value}`)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              )}
            </form.Field>
            <form.AppField name="message">
              {(field) => (
                <field.TextareaField
                  label={t("message")}
                  requiredMark
                  rows={5}
                  maxLength={MAX_MESSAGE}
                  description={t("messageHint")}
                />
              )}
            </form.AppField>
            <p id="talent-enquiry-send-note" className="text-sm text-muted-foreground">
              {t("hint")}
            </p>
            <DialogFooter>
              <Button prominence="secondary" disabled={pending} onClick={() => close(false)}>
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                size="lg"
                pending={pending}
                aria-describedby="talent-enquiry-send-note"
              >
                {t("send")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { TalentEnquiry };
