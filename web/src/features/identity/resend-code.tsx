"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { TextButton } from "@/components/actions/text-button";
import { requestSignInCode, type CodeRequestOutcome } from "@/features/identity/identity-api";

type ResendCodeProps = {
  email: string;
  /** The answer to the request that opened this screen; a limit there already rules out resending. */
  initialOutcome: CodeRequestOutcome;
  /** A new code is on its way, so whatever was typed belongs to the old one. */
  onSent: () => void;
};

/** Sends a new code and says what happened: sent, not sent, or the limit and when it lifts. */
function ResendCode({ email, initialOutcome, onSent }: ResendCodeProps) {
  const t = useTranslations("SignIn.sent");
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  // `null` until the person asks again: the first code is not "a new code".
  const [outcome, setOutcome] = useState<CodeRequestOutcome | null>(
    initialOutcome.kind === "limited" ? initialOutcome : null,
  );

  async function resend() {
    setPending(true);
    const next = await requestSignInCode({ email, locale });
    setOutcome(next);
    setPending(false);
    if (next.kind === "sent") {
      onSent();
    }
  }

  return (
    <div aria-live="polite" className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {outcome?.kind === "limited" ? (
        <p>{t("limited", { minutes: outcome.retryAfterMinutes })}</p>
      ) : (
        <>
          <span className="text-muted-foreground">
            {outcome?.kind === "sent" && t("resent")}
            {(outcome?.kind === "failed" || outcome?.kind === "invalid") && t("resendFailed")}
            {outcome === null && t("resendHint")}
          </span>
          <TextButton
            className="underline"
            disabled={pending}
            aria-busy={pending || undefined}
            onClick={resend}
          >
            {t("resend")}
          </TextButton>
        </>
      )}
    </div>
  );
}

export { ResendCode };
