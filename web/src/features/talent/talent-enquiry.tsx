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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
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
  /** True when the person says they are not looking for work; the dialog says so and still sends. */
  notAvailable: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * "Contact …": what the message is about and the message itself. The person reads it with the
 * sender's name and organization and answers in their workspace; neither address is shared unless
 * they accept. Once sent, the page is read again so it shows the message waiting.
 */
function TalentEnquiry({ slug, name, notAvailable, open, onOpenChange }: TalentEnquiryProps) {
  const t = useTranslations("Talent.enquiry");
  const notify = useNotify();
  const router = useRouter();
  const [topic, setTopic] = useState<EnquiryTopic>("project");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setPending(true);
    try {
      await sendTalentEnquiry({ path: { slug }, body: { topic, message } });
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
            {notAvailable && (
              <p className="rounded-lg border bg-muted px-3 py-2 text-sm">
                {t("notAvailable", { name })}
              </p>
            )}
            <Field>
              <FieldLabel htmlFor="talent-enquiry-topic">{t("topic")}</FieldLabel>
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
              <FieldLabel htmlFor="talent-enquiry">{t("message")}</FieldLabel>
              <Textarea
                id="talent-enquiry"
                rows={5}
                maxLength={2000}
                placeholder={t("placeholder")}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                aria-invalid={invalid || undefined}
              />
              {invalid ? (
                <FieldError>{t("required")}</FieldError>
              ) : (
                <FieldDescription>{t("hint")}</FieldDescription>
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
