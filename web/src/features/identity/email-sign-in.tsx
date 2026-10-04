"use client";

import { CircleAlertIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/actions/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requestSignInLink, type LinkRequestOutcome } from "@/features/identity/identity-api";

/** The backend accepts the same plain shape; anything else is refused there too. */
const emailPattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

type EmailSignInProps = {
  /** The address to start with, when the person comes back to change it. */
  initialEmail?: string;
  submitLabel: string;
  returnTo?: string;
  /** Another method is in progress. */
  disabled: boolean;
  onPendingChange: (pending: boolean) => void;
  /** A link went out, or the address already holds its share of links that still work. */
  onSent: (
    email: string,
    outcome: Extract<LinkRequestOutcome, { kind: "sent" | "limited" }>,
  ) => void;
};

/** Asks for an address and has a sign-in link emailed to it. */
function EmailSignIn({
  initialEmail = "",
  submitLabel,
  returnTo,
  disabled,
  onPendingChange,
  onSent,
}: EmailSignInProps) {
  const t = useTranslations("SignIn");
  const locale = useLocale();
  const errorId = useId();
  const [email, setEmail] = useState(initialEmail);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<"invalid" | "failed" | null>(null);
  // Until the page is interactive a click would submit the form the browser's way: a page load with
  // the address in the URL and no link sent. The button waits for the script instead.
  const interactive = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    if (!emailPattern.test(address)) {
      setProblem("invalid");
      return;
    }
    setProblem(null);
    setPending(true);
    onPendingChange(true);
    const outcome = await requestSignInLink({ email: address, locale, returnTo });
    setPending(false);
    onPendingChange(false);
    if (outcome.kind === "sent" || outcome.kind === "limited") {
      onSent(address, outcome);
    } else {
      setProblem(outcome.kind);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <Field data-invalid={problem === "invalid" || undefined}>
        <FieldLabel htmlFor="sign-in-email">{t("emailLabel")}</FieldLabel>
        <Input
          id="sign-in-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={problem === "invalid" || undefined}
          aria-describedby={problem === "invalid" ? errorId : undefined}
        />
        {problem === "invalid" && <FieldError id={errorId}>{t("invalidEmail")}</FieldError>}
      </Field>
      <Button
        type="submit"
        size="lg"
        className="w-full"
        pending={pending}
        disabled={disabled || !interactive}
      >
        {submitLabel}
      </Button>
      {problem === "failed" && (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>{t("sendFailedTitle")}</AlertTitle>
          <AlertDescription>{t("sendFailedBody", { email: email.trim() })}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}

export { EmailSignIn };
