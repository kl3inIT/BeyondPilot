"use client";

import { CircleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FieldSeparator } from "@/components/ui/field";
import { CheckEmail } from "@/features/identity/check-email";
import { EmailSignIn } from "@/features/identity/email-sign-in";
import { GoogleButton } from "@/features/identity/google-button";
import type { CodeRequestOutcome } from "@/features/identity/identity-api";

/** What can come back in `?error=` after a round trip; an unknown value shows nothing. */
const errorCodes = ["google"] as const;
type ErrorCode = (typeof errorCodes)[number];

type SignInFormProps = {
  /** A path of this site to return to after signing in, already checked. */
  returnTo?: string;
  /** Where to go when there is no return path. */
  home: string;
  /** The `error` query value, as received. */
  error?: string;
};

/**
 * The sign-in methods and what follows them: Google, or a code by email and then the screen that
 * takes the code. While one method is in progress the other one waits.
 */
function SignInForm({ returnTo, home, error }: SignInFormProps) {
  const t = useTranslations("SignIn");
  const [clickedMethod, setClickedMethod] = useState<"google" | "email" | null>(null);
  const [sent, setSent] = useState<{ email: string; outcome: CodeRequestOutcome } | null>(null);
  const [lastEmail, setLastEmail] = useState("");
  const errorCode = errorCodes.find((code): code is ErrorCode => code === error);

  if (sent) {
    return (
      <CheckEmail
        email={sent.email}
        outcome={sent.outcome}
        destination={returnTo ?? home}
        onChangeEmail={() => setSent(null)}
      />
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">
        {t("title")}
      </h1>
      {errorCode === "google" && (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>{t("googleFailedTitle")}</AlertTitle>
          <AlertDescription>{t("googleFailedBody")}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-4">
        <GoogleButton
          returnTo={returnTo}
          pending={clickedMethod === "google"}
          disabled={clickedMethod === "email"}
          onStart={() => setClickedMethod("google")}
        />
        <FieldSeparator>{t("or")}</FieldSeparator>
        <EmailSignIn
          initialEmail={lastEmail}
          disabled={clickedMethod === "google"}
          onPendingChange={(pending) => setClickedMethod(pending ? "email" : null)}
          onSent={(address, outcome) => {
            setLastEmail(address);
            setSent({ email: address, outcome });
          }}
        />
      </div>
    </>
  );
}

export { SignInForm };
