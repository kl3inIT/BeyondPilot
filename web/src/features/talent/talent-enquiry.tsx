"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useNotify } from "@/hooks/use-notify";
import { sendTalentEnquiry } from "@/lib/api/generated";

import { talentError } from "./talent-errors";

/** What the sender wants to talk about; it words the form, the message itself is free text. */
type EnquiryTopic = "project" | "role";

type TalentEnquiryProps = {
  slug: string;
  /** The person the message goes to, as their profile names them. */
  name: string;
  topic: EnquiryTopic;
  onSent: () => void;
  onCancel: () => void;
};

/**
 * Writes to the person behind a profile. They get the message by email with the sender's address
 * and answer there; their own address is never shown.
 */
function TalentEnquiry({ slug, name, topic, onSent, onCancel }: TalentEnquiryProps) {
  const t = useTranslations("Talent.enquiry");
  const notify = useNotify();
  const field = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [invalid, setInvalid] = useState(false);

  // The form opens from a button that may sit far from it, as the bar at the foot of a phone does.
  useEffect(() => {
    field.current?.focus();
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setPending(true);
    try {
      await sendTalentEnquiry({ path: { slug }, body: { message } });
      onSent();
    } catch (error) {
      notify.error(talentError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3">
      <Field data-invalid={invalid || undefined}>
        <FieldLabel htmlFor="talent-enquiry">{t(`${topic}Label`, { name })}</FieldLabel>
        <Textarea
          ref={field}
          id="talent-enquiry"
          rows={5}
          maxLength={2000}
          placeholder={t(`${topic}Placeholder`)}
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
      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" pending={pending} className="w-full">
          {t("send")}
        </Button>
        <Button prominence="tertiary" size="lg" className="w-full" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

export { TalentEnquiry, type EnquiryTopic };
