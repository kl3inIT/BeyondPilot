"use client";

import { CircleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FieldSeparator } from "@/components/ui/field";
import { CheckEmail } from "@/features/identity/check-email";
import { EmailSignIn } from "@/features/identity/email-sign-in";
import { GoogleButton } from "@/features/identity/google-button";
import type { LinkRequestOutcome } from "@/features/identity/identity-api";

/** What can come back in `?error=` after a round trip; an unknown value shows nothing. */
const errorCodes = ["google"] as const;
type ErrorCode = (typeof errorCodes)[number];

type SignInFormProps = {
  /** `expired` is what a used or expired link lands on: the address comes first, then Google. */
  variant?: "sign-in" | "expired";
  /** A path of this site to return to after signing in. */
  returnTo?: string;
  /** The `error` query value, as received. */
  error?: string;
};

/**
 * The sign-in methods and what follows them: Google, or a link by email and then the screen that
 * says where the link went. While one method is in progress the other one waits.
 */
function SignInForm({ variant = "sign-in", returnTo, error }: SignInFormProps) {
  const t = useTranslations("SignIn");
  const [clickedMethod, setClickedMethod] = useState<"google" | "email" | null>(null);
  const [sent, setSent] = useState<{ email: string; outcome: LinkRequestOutcome } | null>(null);
  const [lastEmail, setLastEmail] = useState("");
  const errorCode = errorCodes.find((code): code is ErrorCode => code === error);

  if (sent) {
    return (
      <CheckEmail
        email={sent.email}
        returnTo={returnTo}
        outcome={sent.outcome}
        onChangeEmail={() => setSent(null)}
      />
    );
  }

  const google = (
    <GoogleButton
      returnTo={returnTo}
      pending={clickedMethod === "google"}
      disabled={clickedMethod === "email"}
      onStart={() => setClickedMethod("google")}
    />
  );
  const email = (
    <EmailSignIn
      initialEmail={lastEmail}
      submitLabel={variant === "expired" ? t("expired.submit") : t("submit")}
      returnTo={returnTo}
      disabled={clickedMethod === "google"}
      onPendingChange={(pending) => setClickedMethod(pending ? "email" : null)}
      onSent={(address, outcome) => {
        setLastEmail(address);
        setSent({ email: address, outcome });
      }}
    />
  );

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">
          {variant === "expired" ? t("expired.title") : t("title")}
        </h1>
        {variant === "expired" && <p className="text-muted-foreground">{t("expired.lead")}</p>}
      </div>
      {errorCode === "google" && (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>{t("googleFailedTitle")}</AlertTitle>
          <AlertDescription>{t("googleFailedBody")}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-4">
        {variant === "expired" ? email : google}
        <FieldSeparator>{t("or")}</FieldSeparator>
        {variant === "expired" ? google : email}
      </div>
    </>
  );
}

export { SignInForm };
