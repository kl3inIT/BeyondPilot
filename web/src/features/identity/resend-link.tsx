"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { TextButton } from "@/components/actions/text-button";
import { requestSignInLink, type LinkRequestOutcome } from "@/features/identity/identity-api";

type ResendLinkProps = {
  email: string;
  returnTo?: string;
  /** The answer to the request that opened this screen; a limit there already rules out resending. */
  initialOutcome: LinkRequestOutcome;
};

/** Sends the link again and says what happened: sent, not sent, or the limit and when it lifts. */
function ResendLink({ email, returnTo, initialOutcome }: ResendLinkProps) {
  const t = useTranslations("SignIn.sent");
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  // `null` until the person asks again: the first link is not "sent again".
  const [outcome, setOutcome] = useState<LinkRequestOutcome | null>(
    initialOutcome.kind === "limited" ? initialOutcome : null,
  );

  async function resend() {
    setPending(true);
    setOutcome(await requestSignInLink({ email, locale, returnTo }));
    setPending(false);
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

export { ResendLink };
