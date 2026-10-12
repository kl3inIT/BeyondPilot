"use client";

import { revalidateLogic } from "@tanstack/react-form";
import { CircleAlertIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { z } from "zod";

import { setServerErrors, useAppForm } from "@/components/form/app-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { requestSignInCode, type CodeRequestOutcome } from "@/features/identity/identity-api";

/** The backend accepts the same plain shape; anything else is refused there too. */
const emailPattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

type EmailSignInProps = {
  /** The address to start with, when the person comes back to change it. */
  initialEmail?: string;
  /** Another method is in progress. */
  disabled: boolean;
  onPendingChange: (pending: boolean) => void;
  /** A code went out, or the address already holds its share of codes that still work. */
  onSent: (
    email: string,
    outcome: Extract<CodeRequestOutcome, { kind: "sent" | "limited" }>,
  ) => void;
};

/** Asks for an address and has a sign-in code emailed to it. */
function EmailSignIn({ initialEmail = "", disabled, onPendingChange, onSent }: EmailSignInProps) {
  const t = useTranslations("SignIn");
  const locale = useLocale();
  // The address is in order and still no code went out: said under the button until the next try.
  const [failed, setFailed] = useState(false);
  // Until the page is interactive a click would submit the form the browser's way: a page load with
  // the address in the URL and no code sent. The button waits for the script instead.
  const interactive = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const form = useAppForm({
    defaultValues: { email: initialEmail },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: z.object({ email: z.string().trim().regex(emailPattern, t("invalidEmail")) }),
    },
    onSubmitInvalid: () => setFailed(false),
    onSubmit: async ({ value, formApi }) => {
      const address = value.email.trim();
      setFailed(false);
      onPendingChange(true);
      const outcome = await requestSignInCode({ email: address, locale });
      onPendingChange(false);
      if (outcome.kind === "sent" || outcome.kind === "limited") {
        onSent(address, outcome);
      } else if (outcome.kind === "invalid") {
        setServerErrors(formApi, { fields: { email: { message: t("invalidEmail") } } });
      } else {
        setFailed(true);
      }
    },
  });

  return (
    <form
      id={form.formId}
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="email">
        {(field) => (
          <field.TextField
            label={t("emailLabel")}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
          />
        )}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton size="lg" className="w-full" disabled={disabled || !interactive}>
          {t("submit")}
        </form.SubmitButton>
      </form.AppForm>
      {failed && (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>{t("sendFailedTitle")}</AlertTitle>
          <AlertDescription>
            <form.Subscribe selector={(state) => state.values.email}>
              {(email) => t("sendFailedBody", { email: email.trim() })}
            </form.Subscribe>
          </AlertDescription>
        </Alert>
      )}
    </form>
  );
}

export { EmailSignIn };
