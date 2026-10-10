"use client";

import { SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { FieldError } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/** One plain address, in the characters the backend accepts for a test recipient. */
const ADDRESS = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

/**
 * Where a test email goes and the button that sends it. The operator's own address is filled in; another address may
 * be written, and the backend records a test to anyone else in the audit log.
 */
function TestSend({
  defaultTo,
  pending,
  disabled,
  onSend,
  className,
}: {
  defaultTo: string;
  pending: boolean;
  disabled?: boolean;
  onSend: (to: string) => void;
  className?: string;
}) {
  const t = useTranslations("Admin.email.testSend");
  const [to, setTo] = useState(defaultTo);
  const [invalid, setInvalid] = useState(false);
  const errorId = useId();

  function send() {
    const address = to.trim();
    if (!ADDRESS.test(address)) {
      setInvalid(true);
      return;
    }
    onSend(address);
  }

  return (
    <div className={cn("flex w-full flex-col gap-1 sm:w-80", className)}>
      <InputGroup data-invalid={invalid || undefined}>
        <InputGroupInput
          type="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={254}
          aria-label={t("to")}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          value={to}
          onChange={(event) => {
            setTo(event.target.value);
            setInvalid(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              send();
            }
          }}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="sm" disabled={pending || disabled} onClick={send}>
            {pending ? <Spinner /> : <SendIcon aria-hidden="true" />}
            {t("send")}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {invalid && <FieldError id={errorId}>{t("invalid")}</FieldError>}
    </div>
  );
}

export { TestSend };
