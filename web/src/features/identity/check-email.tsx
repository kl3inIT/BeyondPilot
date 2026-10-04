"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import type { LinkRequestOutcome } from "@/features/identity/identity-api";
import { ResendLink } from "@/features/identity/resend-link";

const gmailDomains = ["@gmail.com", "@googlemail.com"];

type CheckEmailProps = {
  email: string;
  returnTo?: string;
  outcome: LinkRequestOutcome;
  onChangeEmail: () => void;
};

/** Says where the link went and offers the next moves: open the inbox, send again, or another address. */
function CheckEmail({ email, returnTo, outcome, onChangeEmail }: CheckEmailProps) {
  const t = useTranslations("SignIn.sent");

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">
        {t("title")}
      </h1>
      <p className="text-muted-foreground">
        {t("sentTo")}
        <span className="block font-medium break-all text-foreground">{email}</span>
        {t("validity")}
      </p>
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
        <ResendLink email={email} returnTo={returnTo} initialOutcome={outcome} />
        <button
          type="button"
          className="hit-area rounded-sm font-medium text-muted-foreground underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          onClick={onChangeEmail}
        >
          {t("differentEmail")}
        </button>
      </div>
    </>
  );
}

export { CheckEmail };
