"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { CircleAlertIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  verifySignInCode,
  type CodeCheckOutcome,
  type CodeRequestOutcome,
} from "@/features/identity/identity-api";
import { ResendCode } from "@/features/identity/resend-code";

const codeLength = 6;
const gmailDomains = ["@gmail.com", "@googlemail.com"];

type CheckEmailProps = {
  email: string;
  outcome: CodeRequestOutcome;
  /** Where to go once signed in: the page the person came from, or the home page. */
  destination: string;
  onChangeEmail: () => void;
};

type Problem = Exclude<CodeCheckOutcome, "signed-in">;

/**
 * Says where the code went and takes it. A wrong code can be typed again; an expired one, or one
 * guessed at too often, needs a new code, which the line under the form sends.
 */
function CheckEmail({ email, outcome, destination, onChangeEmail }: CheckEmailProps) {
  const t = useTranslations("SignIn.sent");
  const errorId = useId();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  // A full code submits itself, and so does the button: one check at a time.
  const checking = useRef(false);
  const locked = problem === "locked";

  async function check(typed: string) {
    if (typed.length !== codeLength || checking.current) {
      return;
    }
    checking.current = true;
    setPending(true);
    const result = await verifySignInCode(typed);
    if (result === "signed-in") {
      // A full load, so every server-rendered part of the next page sees the new session. The
      // button stays busy until the page is replaced.
      window.location.replace(destination);
      return;
    }
    checking.current = false;
    setPending(false);
    setProblem(result);
    setCode("");
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">
        {t("title")}
      </h1>
      <p className="text-muted-foreground">
        {t("enterCode")}
        <span className="block font-medium break-all text-foreground">{email}</span>
      </p>
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void check(code);
        }}
      >
        <InputOTP
          maxLength={codeLength}
          pattern={REGEXP_ONLY_DIGITS}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          aria-label={t("codeLabel")}
          aria-invalid={(problem !== null && problem !== "failed") || undefined}
          aria-describedby={problem ? errorId : undefined}
          disabled={locked || pending}
          value={code}
          onChange={(value) => {
            setCode(value);
            if (value.length > 0 && !locked) {
              setProblem(null);
            }
          }}
          onComplete={(value) => void check(value)}
          containerClassName="w-full"
        >
          {Array.from({ length: codeLength }, (_, index) => (
            <InputOTPGroup key={index} className="flex-1">
              <InputOTPSlot
                index={index}
                size="lg"
                aria-invalid={(problem !== null && problem !== "failed") || undefined}
              />
            </InputOTPGroup>
          ))}
        </InputOTP>
        {problem && (
          <p
            id={errorId}
            role="alert"
            className="flex items-start gap-1.5 text-sm text-destructive"
          >
            <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {t(`problem.${problem}`)}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          pending={pending}
          disabled={locked || code.length !== codeLength}
        >
          {t("continue")}
        </Button>
      </form>
      {gmailDomains.some((domain) => email.toLowerCase().endsWith(domain)) && (
        <Button
          prominence="secondary"
          size="lg"
          className="w-full"
          href="https://mail.google.com/"
          target="_blank"
          rel="noreferrer"
        >
          <Image src="/brand/google-g.svg" alt="" width={18} height={18} />
          {t("openGmail")}
        </Button>
      )}
      <div className="flex flex-col items-start gap-2.5 border-t border-border pt-4 text-sm">
        <ResendCode
          email={email}
          initialOutcome={outcome}
          onSent={() => {
            setCode("");
            setProblem(null);
          }}
        />
        <button
          type="button"
          className="hit-area rounded-sm font-medium text-muted-foreground underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          onClick={onChangeEmail}
        >
          {t("differentEmail")}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{t("validity")}</p>
    </>
  );
}

export { CheckEmail };
