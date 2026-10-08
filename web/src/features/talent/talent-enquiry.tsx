"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RequiredMark } from "@/components/composites/required-mark";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useNotify } from "@/hooks/use-notify";
import { sendTalentEnquiry, type SendTalentEnquiry } from "@/lib/api/generated";

import { talentError } from "./talent-errors";

type EnquiryTopic = SendTalentEnquiry["topic"];

const topics: readonly EnquiryTopic[] = ["project", "role", "other"];

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
  const [topic, setTopic] = useState<EnquiryTopic>("project");
  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState(senderName);
  const [pending, setPending] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [unsigned, setUnsigned] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missingName = !signature.trim();
    const missingMessage = !message.trim();
    setUnsigned(missingName);
    setInvalid(missingMessage);
    if (missingName || missingMessage) {
      return;
    }
    setPending(true);
    try {
      await sendTalentEnquiry({ path: { slug }, body: { senderName: signature, topic, message } });
      setSent(true);
    } catch (error) {
      notify.error(talentError(error));
    } finally {
      setPending(false);
    }
  }

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
              <Button size="lg" onClick={() => close(false)}>
                {t("done")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form noValidate onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{t("dialogTitle", { name })}</DialogTitle>
              <DialogDescription>{t("dialogLead", { name })}</DialogDescription>
            </DialogHeader>
            <Field data-invalid={unsigned || undefined}>
              <FieldLabel htmlFor="talent-enquiry-name">
                {t("senderName")}
                <RequiredMark />
              </FieldLabel>
              <Input
                id="talent-enquiry-name"
                autoComplete="name"
                maxLength={120}
                value={signature}
                onChange={(event) => setSignature(event.target.value)}
                aria-invalid={unsigned || undefined}
                aria-describedby="talent-enquiry-name-hint"
              />
              {unsigned ? (
                <FieldError id="talent-enquiry-name-hint">{t("senderNameRequired")}</FieldError>
              ) : (
                <FieldDescription id="talent-enquiry-name-hint">
                  {t("senderNameHint", { name })}
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="talent-enquiry-topic">
                {t("topic")}
                <RequiredMark />
              </FieldLabel>
              <NativeSelect
                id="talent-enquiry-topic"
                className="w-full"
                value={topic}
                onChange={(event) => setTopic(event.target.value as EnquiryTopic)}
              >
                {topics.map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {t(`topics.${value}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field data-invalid={invalid || undefined}>
              <FieldLabel htmlFor="talent-enquiry">
                {t("message")}
                <RequiredMark />
              </FieldLabel>
              <Textarea
                id="talent-enquiry"
                rows={5}
                maxLength={2000}
                placeholder={t("placeholder")}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                aria-invalid={invalid || undefined}
                aria-describedby="talent-enquiry-hint"
              />
              {invalid ? (
                <FieldError id="talent-enquiry-hint">{t("required")}</FieldError>
              ) : (
                <FieldDescription id="talent-enquiry-hint">{t("hint")}</FieldDescription>
              )}
            </Field>
            <DialogFooter>
              <Button prominence="secondary" disabled={pending} onClick={() => close(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" size="lg" pending={pending}>
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
