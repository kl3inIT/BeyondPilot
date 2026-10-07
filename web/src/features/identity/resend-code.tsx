"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { TextButton } from "@/components/actions/text-button";
import { requestSignInCode, type CodeRequestOutcome } from "@/features/identity/identity-api";

type ResendCodeProps = {
  email: string;
  /** The answer to the request that opened this screen; a limit there already rules out resending. */
  initialOutcome: CodeRequestOutcome;
  /** A new code is on its way, so whatever was typed belongs to the old one. */
  onSent: () => void;
};

/**
 * Sends a new code and says what happened: sent, not sent, or how long until another can be asked
 * for. The wait counts down, and the link comes back when it is over.
 */
function ResendCode({ email, initialOutcome, onSent }: ResendCodeProps) {
  const t = useTranslations("SignIn.sent");
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  // `null` until the person asks again: the first code is not "a new code".
  const [outcome, setOutcome] = useState<CodeRequestOutcome | null>(
    initialOutcome.kind === "limited" ? initialOutcome : null,
  );

  const [now, setNow] = useState(() => Date.now());
  const [waitUntil, setWaitUntil] = useState(() =>
    initialOutcome.kind === "limited" ? Date.now() + initialOutcome.retryAfterSeconds * 1000 : 0,
  );
  const waiting = outcome?.kind === "limited" && now < waitUntil;
  const secondsLeft = Math.max(0, Math.ceil((waitUntil - now) / 1000));

  useEffect(() => {
    if (!waiting) {
      return;
    }
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [waiting]);

  async function resend() {
    setPending(true);
    const next = await requestSignInCode({ email, locale });
    if (next.kind === "limited") {
      setNow(Date.now());
      setWaitUntil(Date.now() + next.retryAfterSeconds * 1000);
    }
    setOutcome(next);
    setPending(false);
    if (next.kind === "sent") {
      onSent();
    }
  }

  return (
    <div aria-live="polite" className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {waiting ? (
        <p>
          {t("limited", {
            minutes: secondsLeft >= 60 ? Math.ceil(secondsLeft / 60) : 0,
            seconds: secondsLeft,
          })}
        </p>
      ) : (
        <>
          <span className="text-muted-foreground">
            {outcome?.kind === "sent" && t("resent")}
            {(outcome?.kind === "failed" || outcome?.kind === "invalid") && t("resendFailed")}
            {(outcome === null || outcome.kind === "limited") && t("resendHint")}
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
